import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { HealthModule } from '../src/health/health.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RabbitmqService } from '../src/rabbitmq/rabbitmq.service';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  const prismaServiceMock = {
    $queryRaw: jest.fn(),
  };

  const rabbitmqServiceMock = {
    ping: jest.fn(),
    getExchangeName: jest.fn().mockReturnValue('talentflow.events'),
    getQueueName: jest.fn().mockReturnValue('notification_queue'),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaServiceMock)
      .overrideProvider(RabbitmqService)
      .useValue(rabbitmqServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
    rabbitmqServiceMock.getExchangeName.mockReturnValue('talentflow.events');
    rabbitmqServiceMock.getQueueName.mockReturnValue('notification_queue');
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET) should return 200 with database and rabbitmq status up', async () => {
    prismaServiceMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    rabbitmqServiceMock.ping.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(body.info.database).toEqual({ status: 'up' });
        expect(body.info.rabbitmq).toEqual({
          status: 'up',
          exchange: 'talentflow.events',
          queue: 'notification_queue',
        });
      });
  });
});
