import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
  let previousEnv: NodeJS.ProcessEnv;
  let jwtService: JwtService;

  const jwtSecret = 'test-jwt-secret-please-change';
  const jwtIssuer = 'talentflow-api-gateway';
  const jwtAudience = 'talentflow-notification-service';

  beforeAll(async () => {
    previousEnv = { ...process.env };
    process.env.JWT_SECRET = jwtSecret;
    process.env.JWT_ISSUER = jwtIssuer;
    process.env.JWT_AUDIENCE = jwtAudience;
    process.env.JWT_EXPIRES_IN = '1d';

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
    jwtService = new JwtService({
      secret: jwtSecret,
      signOptions: {
        algorithm: 'HS256',
        issuer: jwtIssuer,
        audience: jwtAudience,
      },
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    for (const key of ['JWT_SECRET', 'JWT_ISSUER', 'JWT_AUDIENCE', 'JWT_EXPIRES_IN']) {
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

  it('GET /api/notifications/:id should return 401 for an invalid bearer token', async () => {
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

  it('GET /api/notifications/:id should return 401 when the token is expired', async () => {
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

  it('GET /api/notifications/:id should return 401 when the token audience is invalid', async () => {
    const server = app.getHttpServer() as Server;
    const invalidAudienceToken = jwtService.sign(
      {
        sub: 'user-123',
        email: 'user@example.com',
        role: 'RECRUITER',
      },
      {
        audience: 'another-service',
      },
    );

    await request(server)
      .get('/api/notifications/user-123')
      .set('Authorization', `Bearer ${invalidAudienceToken}`)
      .expect(401)
      .expect((response: request.Response) => {
        const body = response.body as unknown as UnauthorizedResponseBody;

        expectUnauthorized(body);
      });
  });

  it('GET /api/notifications/:id should return 401 when the token issuer is invalid', async () => {
    const server = app.getHttpServer() as Server;
    const invalidIssuerToken = jwtService.sign(
      {
        sub: 'user-123',
        email: 'user@example.com',
        role: 'RECRUITER',
      },
      {
        issuer: 'another-issuer',
      },
    );

    await request(server)
      .get('/api/notifications/user-123')
      .set('Authorization', `Bearer ${invalidIssuerToken}`)
      .expect(401)
      .expect((response: request.Response) => {
        const body = response.body as unknown as UnauthorizedResponseBody;

        expectUnauthorized(body);
      });
  });

  it('GET /api/notifications/:id should return 401 when the token algorithm is invalid', async () => {
    const server = app.getHttpServer() as Server;
    const invalidAlgorithmToken = jwtService.sign(
      {
        sub: 'user-123',
        email: 'user@example.com',
        role: 'RECRUITER',
      },
      {
        algorithm: 'HS512',
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

  it('GET /api/notifications/:id should return 401 when the authorization header is missing', async () => {
    const server = app.getHttpServer() as Server;

    await request(server)
      .get('/api/notifications/user-123')
      .expect(401)
      .expect((response: request.Response) => {
        const body = response.body as unknown as UnauthorizedResponseBody;

        expectUnauthorized(body);
      });
  });
});
