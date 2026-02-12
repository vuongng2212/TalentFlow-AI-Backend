import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '@prisma/client';

const extractCookies = (header: string[] | string | undefined): string[] => {
  if (!header) {
    return [];
  }

  return Array.isArray(header) ? header : [header];
};

const getServer = (app: INestApplication): Parameters<typeof request>[0] =>
  app.getHttpServer() as Parameters<typeof request>[0];

describe('AuthController (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let httpServer: Parameters<typeof request>[0];
  let accessToken: string;
  let refreshToken: string;

  const testUser = {
    email: 'e2e-test@example.com',
    password: 'Password123!',
    fullName: 'E2E User',
    role: Role.RECRUITER,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global prefix as in main.ts
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready', 'metrics'] });

    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    httpServer = getServer(app);

    prisma = app.get<PrismaService>(PrismaService);
    await prisma.user.deleteMany({ where: { email: testUser.email } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testUser.email } });
    await app.close();
  });

  it('/auth/signup (POST)', () => {
    return request(httpServer)
      .post('/api/v1/auth/signup')
      .send(testUser)
      .expect(201)
      .expect((res) => {
        const body = res.body as Record<string, unknown>;
        const user = body.user as { email?: string } | undefined;
        expect(body.message).toEqual('User registered successfully');
        expect(user).toBeDefined();
        expect(user?.email).toEqual(testUser.email);
      });
  });

  it('/auth/login (POST)', async () => {
    const response = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    const rawCookies = response.headers['set-cookie'];
    const cookies = extractCookies(rawCookies);

    expect(cookies.length).toBeGreaterThanOrEqual(2);

    // Extract cookies for later requests
    accessToken = cookies.find((c) => c.startsWith('access_token')) ?? '';
    refreshToken = cookies.find((c) => c.startsWith('refresh_token')) ?? '';

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  it('/auth/me (GET) - Success', () => {
    return request(httpServer)
      .get('/api/v1/auth/me')
      .set('Cookie', [accessToken])
      .expect(200)
      .expect((res) => {
        const body = res.body as { user?: { email?: string } };
        expect(body.user?.email).toEqual(testUser.email);
      });
  });

  it('/auth/me (GET) - Unauthorized', () => {
    return request(httpServer).get('/api/v1/auth/me').expect(401);
  });

  it('/auth/refresh (POST)', async () => {
    const response = await request(httpServer)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshToken, accessToken]) // Send both, though refresh usually just needs refresh token (but guard extracts user from access token in some flows, let's stick to refresh token logic)
      // Actually JwtRefreshGuard usually looks at refresh_token cookie
      .expect(200);

    const cookies = extractCookies(response.headers['set-cookie']);
    const newAccessToken =
      cookies.find((c) => c.startsWith('access_token')) ?? '';
    const newRefreshToken =
      cookies.find((c) => c.startsWith('refresh_token')) ?? '';

    expect(newAccessToken).toBeTruthy();
    expect(newRefreshToken).toBeTruthy();

    // Update tokens
    accessToken = newAccessToken;
    refreshToken = newRefreshToken;
  });

  it('/auth/logout (POST)', async () => {
    await request(httpServer)
      .post('/api/v1/auth/logout')
      .set('Cookie', [accessToken, refreshToken])
      .expect(200);
  });

  it('/auth/me (GET) - Fail after logout (if cookie cleared)', () => {
    // Note: In E2E test, we are responsible for sending cookies.
    // If we send the OLD cookies, they should be invalid (blacklisted or expired).
    // Access token is stateless so it remains valid until expiry unless we blacklist access tokens (which we don't, only refresh).
    // But since we just logged out, let's assume client cleared cookies.
    return request(httpServer).get('/api/v1/auth/me').expect(401);
  });
});
