/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentTransactionStatus, SubscriptionPlanCode } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { RedisService } from '../src/redis/redis.service';
import { MomoSignatureService } from '../src/subscriptions/billing/momo-signature.service';

const extractCookies = (header: string[] | string | undefined): string[] => {
  if (!header) {
    return [];
  }

  return Array.isArray(header) ? header : [header];
};

describe('Subscriptions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let momoSignatureService: MomoSignatureService;
  let configService: ConfigService;
  let userCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const redisStore = new Map<string, string>();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useValue({
        get: jest.fn((key: string) =>
          Promise.resolve(redisStore.get(key) ?? null),
        ),
        set: jest.fn((key: string, value: string) => {
          redisStore.set(key, value);
          return Promise.resolve('OK');
        }),
        del: jest.fn((key: string) => {
          const existed = redisStore.delete(key);
          return Promise.resolve(existed ? 1 : 0);
        }),
        incr: jest.fn((key: string) => {
          const next = Number(redisStore.get(key) ?? '0') + 1;
          redisStore.set(key, String(next));
          return Promise.resolve(next);
        }),
        expire: jest.fn(() => Promise.resolve(1)),
        ping: jest.fn().mockResolvedValue('PONG'),
        onModuleDestroy: jest.fn(),
      })
      .overrideProvider(QueueService)
      .useValue({
        isHealthy: jest.fn().mockResolvedValue(true),
        getQueueStats: jest.fn().mockResolvedValue([]),
        publishCvUploaded: jest.fn(),
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
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
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
    momoSignatureService = app.get<MomoSignatureService>(MomoSignatureService);
    configService = app.get<ConfigService>(ConfigService);

    await prisma.paymentConfirmation.deleteMany();
    await prisma.paymentTransaction.deleteMany();
    await prisma.aiUsageRecord.deleteMany();
    await prisma.userSubscription.deleteMany();
    await prisma.application.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();

    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'subscription-user@test.com',
      password: 'Password123!',
      fullName: 'Subscription User',
      role: 'RECRUITER',
    });

    const userLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'subscription-user@test.com',
        password: 'Password123!',
      });
    userCookie =
      extractCookies(userLogin.headers['set-cookie']).find((cookie) =>
        cookie.startsWith('access_token'),
      ) ?? '';

    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'subscription-admin@test.com',
      password: 'Password123!',
      fullName: 'Subscription Admin',
      role: 'ADMIN',
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'subscription-admin@test.com',
        password: 'Password123!',
      });
    adminCookie =
      extractCookies(adminLogin.headers['set-cookie']).find((cookie) =>
        cookie.startsWith('access_token'),
      ) ?? '';
  });

  afterAll(async () => {
    await prisma.paymentConfirmation.deleteMany();
    await prisma.paymentTransaction.deleteMany();
    await prisma.aiUsageRecord.deleteMany();
    await prisma.userSubscription.deleteMany();
    await prisma.application.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('lists Free, Plus, and Business with billing metadata', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/plans')
      .set('Cookie', [userCookie])
      .expect(200);

    expect(response.body.data).toEqual([
      expect.objectContaining({
        code: 'FREE',
        isPaid: false,
        priceAmount: 0,
        checkoutEligible: false,
      }),
      expect.objectContaining({
        code: 'PLUS',
        isPaid: true,
        priceAmount: 99000,
        checkoutEligible: true,
      }),
      expect.objectContaining({
        code: 'BUSINESS',
        isPaid: true,
        priceAmount: 499000,
        checkoutEligible: true,
      }),
    ]);
  });

  it('assigns Free by default and exposes pending payment state', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/me')
      .set('Cookie', [userCookie])
      .expect(200);

    expect(response.body.data.currentPlan.code).toBe('FREE');
    expect(response.body.data.pendingPayments).toEqual([]);
  });

  it('creates pending MoMo checkout and does not activate before confirmation', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/subscriptions/checkout')
      .set('Cookie', [userCookie])
      .send({ planCode: SubscriptionPlanCode.PLUS })
      .expect(201);

    expect(response.body.data).toEqual(
      expect.objectContaining({
        planCode: 'PLUS',
        provider: 'MOMO',
        status: 'PENDING',
        checkoutUrl: expect.stringContaining('test-payment.momo.vn'),
      }),
    );

    const status = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/me')
      .set('Cookie', [userCookie])
      .expect(200);

    expect(status.body.data.currentPlan.code).toBe('FREE');
    expect(status.body.data.pendingPayments).toEqual([
      expect.objectContaining({
        paymentId: response.body.data.paymentId,
        planCode: 'PLUS',
        status: 'PENDING',
      }),
    ]);
  });

  it('accepts signed MoMo IPN and activates only through internal confirmation', async () => {
    const checkout = await request(app.getHttpServer())
      .post('/api/v1/subscriptions/checkout')
      .set('Cookie', [userCookie])
      .send({ planCode: SubscriptionPlanCode.PLUS })
      .expect(201);

    const payment = await prisma.paymentTransaction.findUniqueOrThrow({
      where: { id: checkout.body.data.paymentId },
    });
    const payload = {
      partnerCode: 'MOMO_TEST_PARTNER',
      requestId: payment.providerRequestId,
      orderId: payment.providerOrderId,
      amount: payment.expectedAmount,
      orderInfo: 'TalentFlow Plus subscription',
      orderType: 'momo_wallet',
      partnerClientId: payment.userId,
      callbackToken: 'callback-token',
      transId: 'trans-1',
      resultCode: 0,
      message: 'Successful.',
      payType: 'webApp',
      responseTime: Date.now(),
      extraData: '',
      signature: '',
    };
    payload.signature = momoSignatureService.signPaymentResult(
      configService.get<string>('MOMO_ACCESS_KEY', 'test-access-key'),
      configService.get<string>('MOMO_SECRET_KEY', 'test-secret-key'),
      payload,
    );

    await request(app.getHttpServer())
      .post('/api/v1/subscriptions/momo/ipn')
      .set('Cookie', [userCookie])
      .send(payload)
      .expect(202);

    await request(app.getHttpServer())
      .post(
        `/api/v1/internal/subscriptions/payments/${checkout.body.data.paymentId}/confirm`,
      )
      .set('Cookie', [userCookie])
      .send({ note: 'not admin' })
      .expect(403);

    const confirmation = await request(app.getHttpServer())
      .post(
        `/api/v1/internal/subscriptions/payments/${checkout.body.data.paymentId}/confirm`,
      )
      .set('Cookie', [adminCookie])
      .send({ note: 'verified' })
      .expect(200);

    expect(confirmation.body.data).toEqual(
      expect.objectContaining({
        accepted: true,
        paymentStatus: PaymentTransactionStatus.SUCCEEDED,
        subscriptionActivated: true,
        businessWorkspaceId: null,
      }),
    );
  });

  it('activates Business with a mock business workspace id and no lifecycle mutation', async () => {
    const beforeActiveState = {
      users: await prisma.user.count(),
      jobs: await prisma.job.count(),
      candidates: await prisma.candidate.count(),
      applications: await prisma.application.count(),
      interviews: await prisma.interview.count(),
      aiUsageRecords: await prisma.aiUsageRecord.count(),
    };
    const checkout = await request(app.getHttpServer())
      .post('/api/v1/subscriptions/checkout')
      .set('Cookie', [userCookie])
      .send({ planCode: SubscriptionPlanCode.BUSINESS })
      .expect(201);

    await prisma.paymentTransaction.update({
      where: { id: checkout.body.data.paymentId },
      data: {
        status: PaymentTransactionStatus.SUCCEEDED,
        confirmedAt: new Date(),
      },
    });

    const confirmation = await request(app.getHttpServer())
      .post(
        `/api/v1/internal/subscriptions/payments/${checkout.body.data.paymentId}/confirm`,
      )
      .set('Cookie', [adminCookie])
      .send({ note: 'verified business' })
      .expect(200);

    expect(confirmation.body.data).toEqual(
      expect.objectContaining({
        accepted: true,
        paymentStatus: PaymentTransactionStatus.SUCCEEDED,
        subscriptionActivated: true,
        businessWorkspaceId: 'mock-business-workspace',
      }),
    );
    await expect(
      Promise.resolve({
        users: await prisma.user.count(),
        jobs: await prisma.job.count(),
        candidates: await prisma.candidate.count(),
        applications: await prisma.application.count(),
        interviews: await prisma.interview.count(),
        aiUsageRecords: await prisma.aiUsageRecord.count(),
      }),
    ).resolves.toEqual(beforeActiveState);
  });
});
