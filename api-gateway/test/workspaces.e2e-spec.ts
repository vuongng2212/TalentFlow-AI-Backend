import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { RedisService } from '../src/redis/redis.service';

describe('Workspace rollback (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const removedBasePath = ['/api/v1', 'workspaces'].join('/');
  const removedControllerSymbol = ['Workspaces', 'Controller'].join('');
  const removedCreateDtoSymbol = ['Create', 'Workspace', 'Dto'].join('');
  const removedAddMemberDtoSymbol = ['Add', 'Workspace', 'Member', 'Dto'].join(
    '',
  );

  const removedWorkspaceRequests = [
    {
      method: 'post' as const,
      path: removedBasePath,
      body: { name: 'Removed Workspace', isBusiness: true },
    },
    {
      method: 'post' as const,
      path: `${removedBasePath}/00000000-0000-4000-8000-000000000001/members`,
      body: { email: 'removed-member@test.com' },
    },
    {
      method: 'get' as const,
      path: `${removedBasePath}/00000000-0000-4000-8000-000000000001/members`,
    },
    {
      method: 'patch' as const,
      path: `${removedBasePath}/00000000-0000-4000-8000-000000000001/members/00000000-0000-4000-8000-000000000002`,
      body: { role: 'ADMIN' },
    },
  ];

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
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(removedWorkspaceRequests)(
    '$method $path is absent from the active API surface',
    async ({ method, path, body }) => {
      const response = request(app.getHttpServer())[method](path);

      if (body) {
        response.send(body);
      }

      await response.expect(404);
    },
  );

  it('does not mutate active persistence when removed workspace paths are called', async () => {
    const before = await countActiveState();

    for (const removedRequest of removedWorkspaceRequests) {
      const response = request(app.getHttpServer())[removedRequest.method](
        removedRequest.path,
      );

      if (removedRequest.body) {
        response.send(removedRequest.body);
      }

      await response.expect(404);
    }

    await expect(countActiveState()).resolves.toEqual(before);
  });

  it('does not expose workspace management operations in generated contracts', () => {
    const gatewayContract = readJson(
      join(__dirname, '..', 'swagger-spec.json'),
    );
    const publicContract = readJson(
      join(
        __dirname,
        '..',
        '..',
        'docs',
        'openapi',
        'api-gateway.openapi.json',
      ),
    );

    for (const contract of [gatewayContract, publicContract]) {
      expect(JSON.stringify(contract)).not.toContain(removedControllerSymbol);
      expect(JSON.stringify(contract.paths)).not.toContain(
        removedBasePath.replace('/api/v1', ''),
      );
      expect(contract.components?.schemas).not.toHaveProperty(
        removedCreateDtoSymbol,
      );
      expect(contract.components?.schemas).not.toHaveProperty(
        removedAddMemberDtoSymbol,
      );
    }
  });

  const countActiveState = async () => ({
    users: await prisma.user.count(),
    jobs: await prisma.job.count(),
    candidates: await prisma.candidate.count(),
    applications: await prisma.application.count(),
    interviews: await prisma.interview.count(),
    subscriptionPlans: await prisma.subscriptionPlan.count(),
    userSubscriptions: await prisma.userSubscription.count(),
    paymentTransactions: await prisma.paymentTransaction.count(),
    paymentConfirmations: await prisma.paymentConfirmation.count(),
    aiUsageRecords: await prisma.aiUsageRecord.count(),
  });

  const readJson = (path: string) =>
    JSON.parse(readFileSync(path, 'utf8')) as {
      paths?: Record<string, unknown>;
      components?: { schemas?: Record<string, unknown> };
    };
});
