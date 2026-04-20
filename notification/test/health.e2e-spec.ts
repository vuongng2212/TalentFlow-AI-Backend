import { INestApplication } from '@nestjs/common';
import { Server } from 'http';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { HealthModule } from '../src/health/health.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RabbitmqService } from '../src/rabbitmq/rabbitmq.service';

type HealthResponseBody = {
  status: string;
  info: {
    database: {
      status: string;
    };
    rabbitmq: {
      status: string;
      exchange: string;
      queue: string;
    };
  };
};

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
    const server = app.getHttpServer() as Server;

    await request(server)
      .get('/health')
      .expect(200)
      .expect((response: request.Response) => {
        const body = response.body as unknown as HealthResponseBody;

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
