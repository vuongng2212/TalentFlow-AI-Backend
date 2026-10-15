/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { InvoiceRendererService } from '../src/payments/invoice/invoice-renderer.service';
import { InvoiceStorageService } from '../src/payments/invoice/invoice-storage.service';
import { MomoClient } from '../src/payments/momo/momo.client';
import { PaymentRecoveryService } from '../src/payments/payment-recovery.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { WorkspaceMemberRole, WorkspaceMemberStatus } from '@prisma/client';

jest.setTimeout(30_000);

const extractCookie = (header: string[] | string | undefined): string => {
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  return cookies.find((cookie) => cookie.startsWith('access_token')) ?? '';
};

describe('MoMo payments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let recovery: PaymentRecoveryService;
  let workspaceId: string;
  let ownerCookie: string;
  let recruiterCookie: string;
  let paymentReference: string;
  let pendingPaymentReference: string;
  let momoRequestId: string;
  let momoOrderId: string;
  let momoPartnerCode: string;
  let momoAccessKey: string;
  let momoSecretKey: string;

  const momo = {
    createCheckout: jest.fn().mockResolvedValue({
      resultCode: 0,
      payUrl: 'https://momo.test/checkout',
    }),
    queryPayment: jest.fn(),
  };
  const invoiceStorage = {
    putReceipt: jest.fn().mockResolvedValue({
      bucket: 'payment-private',
      key: 'invoices/TFI_1.pdf',
      contentSha256: 'a'.repeat(64),
    }),
    createDownloadUrl: jest.fn().mockResolvedValue({
      url: 'https://download.test/receipt?signature=redacted',
      expiresAt: new Date('2026-09-18T00:05:00.000Z'),
    }),
  };
  const invoiceRenderer = {
    render: jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary render failure'))
      .mockResolvedValue(Buffer.from('%PDF-test')),
  };

  const owner = {
    email: 'payment-owner-020@test.com',
    fullName: 'Payment Owner',
  };
  const recruiter = {
    email: 'payment-recruiter-020@test.com',
    fullName: 'Payment Recruiter',
  };

  const signUpAndLogin = async (email: string, fullName: string) => {
    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email,
      password: 'Password123!',
      fullName,
      role: 'RECRUITER',
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123!' })
      .expect(200);
    return extractCookie(login.headers['set-cookie']);
  };

  const cleanFixtures = async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: [owner.email, recruiter.email] } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    const workspaces = await prisma.workspace.findMany({
      where: { createdById: { in: userIds } },
      select: { id: true },
    });
    const workspaceIds = workspaces.map((workspace) => workspace.id);
    if (workspaceIds.length > 0) {
      const payments = await prisma.payment.findMany({
        where: { workspaceId: { in: workspaceIds } },
        select: { id: true },
      });
      const paymentIds = payments.map((payment) => payment.id);
      if (paymentIds.length > 0) {
        await prisma.paymentAuditEvent.deleteMany({
          where: { paymentId: { in: paymentIds } },
        });
        await prisma.paymentProviderResult.deleteMany({
          where: { paymentId: { in: paymentIds } },
        });
        await prisma.paymentProcessingRecord.deleteMany({
          where: { paymentId: { in: paymentIds } },
        });
        await prisma.invoice.deleteMany({
          where: { paymentId: { in: paymentIds } },
        });
        await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
      }
      await prisma.workspaceMember.deleteMany({
        where: { workspaceId: { in: workspaceIds } },
      });
      await prisma.subscription.deleteMany({
        where: { workspaceId: { in: workspaceIds } },
      });
      await prisma.user.updateMany({
        where: { activeWorkspaceId: { in: workspaceIds } },
        data: { activeWorkspaceId: null },
      });
      await prisma.workspace.deleteMany({
        where: { id: { in: workspaceIds } },
      });
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  };

  const signedIpn = (resultCode: number, message: string) => {
    const payload = {
      partnerCode: momoPartnerCode,
      orderId: momoOrderId,
      requestId: momoRequestId,
      amount: 10000,
      orderInfo: `TalentFlow payment ${paymentReference}`,
      orderType: 'momo_wallet',
      transId: '901',
      resultCode,
      message,
      payType: 'qr',
      responseTime: '1726617600000',
      extraData: '',
    };
    const canonical = [
      ['accessKey', momoAccessKey],
      ['amount', String(payload.amount)],
      ['extraData', payload.extraData],
      ['message', payload.message],
      ['orderId', payload.orderId],
      ['orderInfo', payload.orderInfo],
      ['orderType', payload.orderType],
      ['partnerCode', payload.partnerCode],
      ['payType', payload.payType],
      ['requestId', payload.requestId],
      ['responseTime', payload.responseTime],
      ['resultCode', String(payload.resultCode)],
      ['transId', payload.transId],
    ]
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return {
      ...payload,
      signature: createHmac('sha256', momoSecretKey)
        .update(canonical)
        .digest('hex'),
    };
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOMO_PARTNER_CODE = 'test-partner-code';
    process.env.MOMO_ACCESS_KEY = 'test-access-key';
    process.env.MOMO_SECRET_KEY = 'test-momo-secret-key-change-me';
    process.env.MOMO_API_BASE_URL = 'https://test-payment.momo.vn';
    process.env.MOMO_IPN_URL =
      'https://payments.test.local/api/v1/payments/momo/ipn';
    process.env.MOMO_REDIRECT_URL = 'http://localhost:3001/payment/return';
    process.env.PAYMENT_CATALOG_JSON = JSON.stringify([
      {
        code: 'DEMO_SERVICE',
        description: 'Demo service',
        amountVnd: 10000,
        taxVnd: 0,
        termsVersion: 'e2e',
        enabled: true,
      },
      {
        code: 'ALT_SERVICE',
        description: 'Alternative demo service',
        amountVnd: 15000,
        taxVnd: 0,
        termsVersion: 'e2e',
        enabled: true,
      },
    ]);
    // ConfigModule.forRoot() validates and caches env at import time, so the
    // app module is loaded only after the e2e overrides above are in place.
    const { AppModule } =
      jest.requireActual<typeof import('../src/app.module')>(
        '../src/app.module',
      );
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MomoClient)
      .useValue(momo)
      .overrideProvider(InvoiceRendererService)
      .useValue(invoiceRenderer)
      .overrideProvider(InvoiceStorageService)
      .useValue(invoiceStorage)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready', 'metrics'] });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    recovery = app.get(PaymentRecoveryService);
    const config = app.get(ConfigService);
    momoPartnerCode = config.getOrThrow<string>('MOMO_PARTNER_CODE');
    momoAccessKey = config.getOrThrow<string>('MOMO_ACCESS_KEY');
    momoSecretKey = config.getOrThrow<string>('MOMO_SECRET_KEY');
    await cleanFixtures();

    ownerCookie = await signUpAndLogin(owner.email, owner.fullName);
    recruiterCookie = await signUpAndLogin(recruiter.email, recruiter.fullName);
    const workspace = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', [ownerCookie])
      .send({ name: 'Payment E2E Workspace' })
      .expect(201);
    workspaceId = workspace.body.data.id as string;
    const recruiterUser = await prisma.user.findUniqueOrThrow({
      where: { email: recruiter.email },
    });
    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: recruiterUser.id,
        role: WorkspaceMemberRole.RECRUITER,
        status: WorkspaceMemberStatus.ACTIVE,
      },
    });
  });

  afterAll(async () => {
    if (app) {
      await cleanFixtures();
      await app.close();
    }
  });

  it('creates one checkout for a replayed owner request and rejects a recruiter', async () => {
    const key = 'payment-e2e-idempotency-key-1';
    await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .send({ payableItemCode: 'DEMO_SERVICE' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .set('Idempotency-Key', 'short')
      .send({ payableItemCode: 'DEMO_SERVICE' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .set('Idempotency-Key', 'payment-e2e-invalid-body')
      .send({ payableItemCode: 'DEMO_SERVICE', amountVnd: 1 })
      .expect(400);
    const first = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .set('Idempotency-Key', key)
      .send({ payableItemCode: 'DEMO_SERVICE' })
      .expect(201);
    paymentReference = first.body.data.reference as string;
    const momoIdentifiers = await prisma.payment.findUniqueOrThrow({
      where: { reference: paymentReference },
      select: { momoOrderId: true, momoRequestId: true },
    });
    momoRequestId = momoIdentifiers.momoRequestId;
    momoOrderId = momoIdentifiers.momoOrderId;

    await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .set('Idempotency-Key', key)
      .send({ payableItemCode: 'DEMO_SERVICE' })
      .expect(201)
      .expect((response) => {
        expect(response.body.data.reference).toBe(paymentReference);
      });

    await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .set('Idempotency-Key', key)
      .send({ payableItemCode: 'ALT_SERVICE' })
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .set('Idempotency-Key', 'payment-e2e-unknown-item')
      .send({ payableItemCode: 'UNKNOWN_SERVICE' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Cookie', [recruiterCookie])
      .set('x-workspace-id', workspaceId)
      .set('Idempotency-Key', 'payment-e2e-idempotency-key-2')
      .send({ payableItemCode: 'DEMO_SERVICE' })
      .expect(403);

    const concurrentKey = 'payment-e2e-concurrent-key-1';
    const concurrentRequests = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post('/api/v1/payments')
          .set('Cookie', [ownerCookie])
          .set('x-workspace-id', workspaceId)
          .set('Idempotency-Key', concurrentKey)
          .send({ payableItemCode: 'ALT_SERVICE' }),
      ),
    );
    const concurrentStatuses = concurrentRequests.map(
      (response) => response.status,
    );
    expect(concurrentStatuses).toEqual(expect.arrayContaining([201]));
    expect(
      concurrentStatuses.every((status) => [201, 202].includes(status)),
    ).toBe(true);
    expect(concurrentRequests[0].body.data.reference).toBe(
      concurrentRequests[1].body.data.reference,
    );
    pendingPaymentReference = concurrentRequests[0].body.data
      .reference as string;

    const secondWorkspace = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', [ownerCookie])
      .send({ name: 'Separate Payment E2E Workspace' })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/api/v1/payments/${paymentReference}`)
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', secondWorkspace.body.data.id as string)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/payments/${paymentReference}/invoice`)
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', secondWorkspace.body.data.id as string)
      .expect(404);

    await expect(
      prisma.payment.count({ where: { workspaceId } }),
    ).resolves.toBe(2);
    expect(momo.createCheckout).toHaveBeenCalledTimes(2);
  });

  it('processes a signed success exactly once and retains a late failure as conflict evidence', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/payments/${pendingPaymentReference}/invoice`)
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/payments/${pendingPaymentReference}/reconcile`)
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/payments/momo/ipn')
      .send(signedIpn(0, 'Success'))
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/payments/momo/ipn')
      .send(signedIpn(0, 'Success'))
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/payments/momo/ipn')
      .send(signedIpn(49, 'Cancelled after success'))
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/payments/momo/ipn')
      .send({ ...signedIpn(0, 'Tampered'), signature: 'b'.repeat(64) })
      .expect(204);

    await recovery.runDueWork();
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { reference: paymentReference },
      include: { providerResults: true },
    });
    expect(payment.status).toBe('SUCCEEDED');
    expect(payment.outcomeRecordedAt).toBeInstanceOf(Date);
    expect(payment.providerResults).toHaveLength(3);
    expect(payment.providerResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          disposition: 'REJECTED',
          reasonCode: 'INVALID_SIGNATURE',
        }),
      ]),
    );

    await recovery.runDueWork();
    await recovery.runDueWork();
    await expect(
      prisma.invoice.count({ where: { paymentId: payment.id } }),
    ).resolves.toBe(1);

    await request(app.getHttpServer())
      .get(`/api/v1/payments/${paymentReference}/invoice`)
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.documentStatus).toBe('RETRYABLE');
        expect(response.body.data).not.toHaveProperty('downloadUrl');
      });
    await request(app.getHttpServer())
      .get(`/api/v1/payments/${paymentReference}/invoice/download`)
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .expect(202)
      .expect((response) => {
        expect(response.body.data.documentStatus).toBe('RETRYABLE');
      });

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await recovery.runDueWork();
    await request(app.getHttpServer())
      .get(`/api/v1/payments/${paymentReference}/invoice/download`)
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.downloadUrl).toContain('download.test');
      });

    await request(app.getHttpServer())
      .get('/api/v1/payments?limit=10')
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ reference: paymentReference }),
          ]),
        );
      });
    await request(app.getHttpServer())
      .get('/api/v1/payments?limit=10')
      .set('Cookie', [recruiterCookie])
      .set('x-workspace-id', workspaceId)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/payments/${paymentReference}`)
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.providerResults[0]).not.toHaveProperty(
          'safePayload',
        );
        expect(response.body.data).not.toHaveProperty('checkout');
      });
    await request(app.getHttpServer())
      .post(`/api/v1/payments/${paymentReference}/reconcile`)
      .set('Cookie', [recruiterCookie])
      .set('x-workspace-id', workspaceId)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/payments/${paymentReference}/reconcile`)
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .expect(400);
  });
});
