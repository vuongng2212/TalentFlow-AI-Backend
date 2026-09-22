import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'http';
import * as request from 'supertest';
import { appConfig } from '../src/config/app.config';
import { jwtConfig } from '../src/config/jwt.config';
import { EmailService } from '../src/email/email.service';
import { NotificationModule } from '../src/notification/notification.module';
import { PrismaService } from '../src/prisma/prisma.service';

type UnauthorizedResponseBody = {
  statusCode: number;
  error: string;
};

describe('NotificationController (e2e)', () => {
  let app: INestApplication;
  let previousEnv: NodeJS.ProcessEnv;
  let jwtService: JwtService;
  let emailService: jest.Mocked<Pick<EmailService, 'sendEmail'>>;
  let prismaService: {
    notification: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
  };

  const jwtAccessSecret = 'test-access-secret-change-me';

  beforeAll(async () => {
    previousEnv = { ...process.env };
    process.env.JWT_ACCESS_SECRET = jwtAccessSecret;
    process.env.JWT_EXPIRES_IN = '1d';
    process.env.WS_CORS_ORIGIN = 'http://localhost:3000';

    let pendingNotification: Record<string, unknown> = {};
    prismaService = {
      notification: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
            Promise.resolve({
              ...pendingNotification,
              ...data,
              updatedAt: new Date(),
            }),
          ),
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            pendingNotification = {
              id: 'persisted-notification-id',
              applicationId: null,
              subject: null,
              recipient: null,
              templateId: null,
              templateData: null,
              metadata: null,
              externalId: null,
              isRead: false,
              readAt: null,
              sentAt: null,
              failedAt: null,
              errorMessage: null,
              expiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
              ...data,
            };
            return Promise.resolve(pendingNotification);
          }),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [appConfig, jwtConfig],
        }),
        NotificationModule,
      ],
    })
      .overrideProvider(EmailService)
      .useValue({
        sendEmail: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    emailService = moduleFixture.get(EmailService);
    jwtService = new JwtService({
      secret: jwtAccessSecret,
      signOptions: {
        algorithm: 'HS256',
      },
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    for (const key of [
      'JWT_ACCESS_SECRET',
      'JWT_EXPIRES_IN',
      'WS_CORS_ORIGIN',
    ]) {
      const previousValue = previousEnv[key];

      if (typeof previousValue === 'undefined') {
        delete process.env[key];
        continue;
      }

      process.env[key] = previousValue;
    }
  });

  function expectUnauthorized(body: unknown) {
    expect(body).toMatchObject({
      statusCode: 401,
      error: 'Unauthorized',
    });
  }

  function createValidToken(userId = 'user-123'): string {
    return jwtService.sign(
      {
        sub: userId,
        email: 'user@example.com',
        role: 'RECRUITER',
      },
      { expiresIn: '1h' },
    );
  }

  it('GET /api/notifications/:userId should return 401 for an invalid bearer token', async () => {
    const server = app.getHttpServer() as Server;

    await request(server)
      .get('/api/notifications/user-123')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401)
      .expect((response: request.Response) => {
        const body = response.body as unknown as UnauthorizedResponseBody;

        expectUnauthorized(body);
      });
  });

  it('GET /api/notifications/:userId should return 401 when the token is expired', async () => {
    const server = app.getHttpServer() as Server;
    const expiredToken = jwtService.sign(
      {
        sub: 'user-123',
        email: 'user@example.com',
        role: 'RECRUITER',
      },
      { expiresIn: -1 },
    );

    await request(server)
      .get('/api/notifications/user-123')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401)
      .expect((response: request.Response) => {
        const body = response.body as unknown as UnauthorizedResponseBody;

        expectUnauthorized(body);
      });
  });

  it('GET /api/notifications/:userId should return 401 when the token signature is invalid', async () => {
    const server = app.getHttpServer() as Server;
    const wrongSecretJwtService = new JwtService({
      secret: 'wrong-access-secret-change-me',
      signOptions: {
        algorithm: 'HS256',
      },
    });
    const wrongSignatureToken = wrongSecretJwtService.sign(
      {
        sub: 'user-123',
        email: 'user@example.com',
        role: 'RECRUITER',
      },
      { expiresIn: '1h' },
    );

    await request(server)
      .get('/api/notifications/user-123')
      .set('Authorization', `Bearer ${wrongSignatureToken}`)
      .expect(401)
      .expect((response: request.Response) => {
        const body = response.body as unknown as UnauthorizedResponseBody;

        expectUnauthorized(body);
      });
  });

  it('GET /api/notifications/:userId should return 401 when the token algorithm is invalid', async () => {
    const server = app.getHttpServer() as Server;
    const invalidAlgorithmToken = jwtService.sign(
      {
        sub: 'user-123',
        email: 'user@example.com',
        role: 'RECRUITER',
      },
      {
        algorithm: 'HS512',
        expiresIn: '1h',
      },
    );

    await request(server)
      .get('/api/notifications/user-123')
      .set('Authorization', `Bearer ${invalidAlgorithmToken}`)
      .expect(401)
      .expect((response: request.Response) => {
        const body = response.body as unknown as UnauthorizedResponseBody;

        expectUnauthorized(body);
      });
  });

  it('GET /api/notifications/:userId should return 401 when the authorization header is missing', async () => {
    const server = app.getHttpServer() as Server;

    await request(server)
      .get('/api/notifications/user-123')
      .expect(401)
      .expect((response: request.Response) => {
        const body = response.body as unknown as UnauthorizedResponseBody;

        expectUnauthorized(body);
      });
  });

  it('POST /api/notifications/send should return 401 when the authorization header is missing', async () => {
    const server = app.getHttpServer() as Server;

    await request(server)
      .post('/api/notifications/send')
      .send({
        to: 'candidate@example.com',
        subject: 'Test',
        body: 'Hello',
        type: 'email',
      })
      .expect(401)
      .expect((response: request.Response) => {
        expectUnauthorized(response.body);
      });
  });

  it('POST /api/notifications/send should return 400 for invalid email payload', async () => {
    const server = app.getHttpServer() as Server;

    await request(server)
      .post('/api/notifications/send')
      .set('Authorization', `Bearer ${createValidToken()}`)
      .send({
        to: 'invalid-email',
        subject: 'Test',
        body: 'Hello',
        type: 'email',
      })
      .expect(400);
  });

  it('POST /api/notifications/send should send an email for a valid request', async () => {
    const server = app.getHttpServer() as Server;

    await request(server)
      .post('/api/notifications/send')
      .set('Authorization', `Bearer ${createValidToken()}`)
      .send({
        to: 'candidate@example.com',
        subject: 'Test',
        body: 'Hello',
        type: 'email',
      })
      .expect(201)
      .expect((response: request.Response) => {
        expect(response.body).toMatchObject({
          userId: 'user-123',
          type: 'email',
          channel: 'email',
          title: 'Test',
          message: 'Hello',
          recipient: 'candidate@example.com',
          subject: 'Test',
          status: 'sent',
          read: false,
        });
      });

    expect(emailService.sendEmail).toHaveBeenCalledWith({
      to: 'candidate@example.com',
      subject: 'Test',
      body: 'Hello',
      templateId: undefined,
      templateData: undefined,
    });
  });

  it('GET /api/notifications/:userId returns an owned paginated history', async () => {
    prismaService.notification.findMany.mockResolvedValue([
      {
        id: 'notification-1',
        userId: 'user-123',
        applicationId: null,
        type: 'APPLICATION_UPDATE',
        channel: 'EMAIL',
        title: 'Application updated',
        message: 'Your application has been reviewed.',
        subject: null,
        recipient: null,
        templateId: null,
        templateData: null,
        metadata: null,
        externalId: null,
        status: 'SENT',
        isRead: false,
        readAt: null,
        sentAt: new Date('2026-09-10T08:00:00.000Z'),
        failedAt: null,
        errorMessage: null,
        expiresAt: null,
        createdAt: new Date('2026-09-10T07:59:00.000Z'),
        updatedAt: new Date('2026-09-10T08:00:00.000Z'),
        deletedAt: null,
      },
    ]);
    prismaService.notification.count.mockResolvedValue(1);

    await request(app.getHttpServer() as Server)
      .get('/api/notifications/user-123?page=1&limit=20')
      .set('Authorization', `Bearer ${createValidToken()}`)
      .expect(200)
      .expect((response: request.Response) => {
        expect(response.body).toMatchObject({
          success: true,
          data: [
            {
              id: 'notification-1',
              userId: 'user-123',
              isRead: false,
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      });
  });

  it('GET /api/notifications/:userId rejects access to another user history', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/notifications/another-user')
      .set('Authorization', `Bearer ${createValidToken()}`)
      .expect(403);
  });

  it('GET /api/notifications/:userId rejects invalid pagination', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/notifications/user-123?page=0&limit=101')
      .set('Authorization', `Bearer ${createValidToken()}`)
      .expect(400);
  });

  it('GET /api/notifications/:userId/unread-count returns the owned count', async () => {
    prismaService.notification.count.mockResolvedValue(3);

    await request(app.getHttpServer() as Server)
      .get('/api/notifications/user-123/unread-count')
      .set('Authorization', `Bearer ${createValidToken()}`)
      .expect(200)
      .expect({ success: true, data: { count: 3 } });
  });

  it('PUT /api/notifications/:id/read rejects another user notification', async () => {
    prismaService.notification.findFirst.mockResolvedValue({
      id: 'notification-1',
      userId: 'another-user',
      applicationId: null,
      type: 'SYSTEM',
      channel: 'IN_APP',
      title: 'Private',
      message: 'Private notification',
      subject: null,
      recipient: null,
      templateId: null,
      templateData: null,
      metadata: null,
      externalId: null,
      status: 'SENT',
      isRead: false,
      readAt: null,
      sentAt: null,
      failedAt: null,
      errorMessage: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    await request(app.getHttpServer() as Server)
      .put('/api/notifications/notification-1/read')
      .set('Authorization', `Bearer ${createValidToken()}`)
      .expect(403);
  });

  it('DELETE /api/notifications/:id soft deletes an owned notification', async () => {
    const stored = {
      id: 'notification-1',
      userId: 'user-123',
      applicationId: null,
      type: 'SYSTEM',
      channel: 'IN_APP',
      title: 'Owned',
      message: 'Owned notification',
      subject: null,
      recipient: null,
      templateId: null,
      templateData: null,
      metadata: null,
      externalId: null,
      status: 'SENT',
      isRead: false,
      readAt: null,
      sentAt: null,
      failedAt: null,
      errorMessage: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    prismaService.notification.findFirst.mockResolvedValue(stored);
    prismaService.notification.update.mockResolvedValue(stored);

    await request(app.getHttpServer() as Server)
      .delete('/api/notifications/notification-1')
      .set('Authorization', `Bearer ${createValidToken()}`)
      .expect(200)
      .expect({ success: true });

    expect(prismaService.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-1' },
      data: { deletedAt: expect.any(Date) as Date },
    });
  });
});
