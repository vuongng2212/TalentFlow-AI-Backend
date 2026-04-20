import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'http';
import * as request from 'supertest';
import { jwtConfig } from '../src/config/jwt.config';
import { NotificationModule } from '../src/notification/notification.module';

type UnauthorizedResponseBody = {
  statusCode: number;
  error: string;
};

describe('NotificationController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig],
        }),
        NotificationModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/notifications/:id should return 401 for an invalid bearer token', async () => {
    const server = app.getHttpServer() as Server;

    await request(server)
      .get('/api/notifications/user-123')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401)
      .expect((response: request.Response) => {
        const body = response.body as unknown as UnauthorizedResponseBody;

        expect(body.statusCode).toBe(401);
        expect(body.error).toBe('Unauthorized');
      });
  });
});
