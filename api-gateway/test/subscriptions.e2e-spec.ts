/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';

const extractCookies = (header: string[] | string | undefined): string[] => {
  if (!header) {
    return [];
  }

  return Array.isArray(header) ? header : [header];
};

describe('Subscriptions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerCookie: string;
  let memberCookie: string;
  let workspaceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

    await prisma.aiUsageRecord.deleteMany();
    await prisma.workspaceSubscription.deleteMany();
    await prisma.userSubscription.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.application.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();

    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'subscription-owner@test.com',
      password: 'Password123!',
      fullName: 'Subscription Owner',
      role: 'RECRUITER',
    });

    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'subscription-owner@test.com',
        password: 'Password123!',
      });
    ownerCookie =
      extractCookies(ownerLogin.headers['set-cookie']).find((cookie) =>
        cookie.startsWith('access_token'),
      ) ?? '';

    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'subscription-member@test.com',
      password: 'Password123!',
      fullName: 'Subscription Member',
      role: 'RECRUITER',
    });

    const memberLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'subscription-member@test.com',
        password: 'Password123!',
      });
    memberCookie =
      extractCookies(memberLogin.headers['set-cookie']).find((cookie) =>
        cookie.startsWith('access_token'),
      ) ?? '';
  });

  afterAll(async () => {
    await prisma.aiUsageRecord.deleteMany();
    await prisma.workspaceSubscription.deleteMany();
    await prisma.userSubscription.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.application.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('assigns Free by default and exposes personal status', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/me')
      .set('Cookie', [ownerCookie])
      .expect(200);

    expect(response.body.data.effectivePlan.code).toBe('FREE');
    expect(response.body.data.remainingDailyQuota).toBe(5);
    expect(response.body.data.remainingTrialQuota).toBe(15);
  });

  it('activates Plus for personal context', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/subscriptions/me/plus')
      .set('Cookie', [ownerCookie])
      .expect(201);

    expect(response.body.data.effectivePlan.code).toBe('PLUS');
    expect(response.body.data.remainingDailyQuota).toBe(20);
  });

  it('keeps Business workspace quota separate from Plus personal quota', async () => {
    const workspace = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', [ownerCookie])
      .send({ name: 'Subscription Workspace' })
      .expect(201);
    workspaceId = workspace.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/subscription/business`)
      .set('Cookie', [ownerCookie])
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/members`)
      .set('Cookie', [ownerCookie])
      .send({ email: 'subscription-member@test.com' })
      .expect(201);

    const personal = await request(app.getHttpServer())
      .post('/api/v1/subscriptions/entitlement/check')
      .set('Cookie', [memberCookie])
      .send({
        contextType: 'personal',
        action: 'cv_score',
      })
      .expect(200);

    const workspaceDecision = await request(app.getHttpServer())
      .post('/api/v1/subscriptions/entitlement/check')
      .set('Cookie', [memberCookie])
      .send({
        contextType: 'workspace',
        workspaceId,
        action: 'cv_score',
      })
      .expect(200);

    expect(personal.body.data.resolvedPlan).toBe('Free');
    expect(workspaceDecision.body.data.resolvedPlan).toBe('Business');
    expect(workspaceDecision.body.data.remainingDailyQuota).toBe(500);
  });
});
