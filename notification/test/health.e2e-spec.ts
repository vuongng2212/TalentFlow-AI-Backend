import { INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Server } from 'http';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { jwtConfig } from '../src/config/jwt.config';
import { rabbitmqConfig } from '../src/config/rabbitmq.config';
import { smtpConfig } from '../src/config/smtp.config';
import { HealthModule } from '../src/health/health.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationConsumer } from '../src/rabbitmq/notification.consumer';
import { RabbitmqService } from '../src/rabbitmq/rabbitmq.service';

type HealthResponseBody = {
  status: string;
};

describe('HealthController (e2e)', () => {
  let app: INestApplication;
  let loggerErrorSpy: jest.SpyInstance;
  let previousEnv: NodeJS.ProcessEnv;

  const prismaServiceMock = {
    $queryRaw: jest.fn(),
  };

  const rabbitmqServiceMock = {
    ping: jest.fn(),
  };

  beforeAll(async () => {
    previousEnv = { ...process.env };
    process.env.JWT_SECRET = 'test-jwt-secret-please-change';
    process.env.JWT_ISSUER = 'talentflow-api-gateway';
    process.env.JWT_AUDIENCE = 'talentflow-notification-service';
    process.env.JWT_EXPIRES_IN = '1d';

    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig, rabbitmqConfig, smtpConfig],
        }),
        HealthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaServiceMock)
      .overrideProvider(RabbitmqService)
      .useValue(rabbitmqServiceMock)
      .overrideProvider(NotificationConsumer)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app?.close();
    loggerErrorSpy.mockRestore();
    process.env = previousEnv;
  });

  it('/health (GET) should return 200 with a generic success payload', async () => {
    prismaServiceMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    rabbitmqServiceMock.ping.mockResolvedValue(undefined);
    const server = app.getHttpServer() as Server;

    await request(server)
      .get('/health')
      .expect(200)
      .expect((response: request.Response) => {
        const body = response.body as unknown as HealthResponseBody;

        expect(body.status).toBe('ok');
        expect(body).not.toHaveProperty('info');
        expect(body).not.toHaveProperty('error');
        expect(body).not.toHaveProperty('details');
      });
  });

  it('/health (GET) should return 503 with a generic error payload when database is unavailable', async () => {
    prismaServiceMock.$queryRaw.mockRejectedValue(
      new Error('database timeout'),
    );
    rabbitmqServiceMock.ping.mockResolvedValue(undefined);
    const server = app.getHttpServer() as Server;

    await request(server)
      .get('/health')
      .expect(503)
      .expect((response: request.Response) => {
        const body = response.body as unknown as HealthResponseBody;

        expect(body).toEqual({ status: 'error' });
        expect(body).not.toHaveProperty('info');
        expect(body).not.toHaveProperty('error');
        expect(body).not.toHaveProperty('details');
      });

    expect(loggerErrorSpy).toHaveBeenCalled();
  });

  it('/health/ready (GET) should return 503 with a generic error payload when RabbitMQ is unavailable', async () => {
    prismaServiceMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    rabbitmqServiceMock.ping.mockRejectedValue(new Error('channel closed'));
    const server = app.getHttpServer() as Server;

    await request(server)
      .get('/health/ready')
      .expect(503)
      .expect((response: request.Response) => {
        const body = response.body as unknown as HealthResponseBody;

        expect(body).toEqual({ status: 'error' });
        expect(body).not.toHaveProperty('info');
        expect(body).not.toHaveProperty('error');
        expect(body).not.toHaveProperty('details');
      });

    expect(loggerErrorSpy).toHaveBeenCalled();
  });
});
