import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Important: We must replicate the global prefix logic if we want to test routes as they appear in main.ts
    // However, the test environment doesn't automatically load main.ts.
    // So we need to set the global prefix here if we expect it.
    // BUT AppController is NOT excluded from the prefix. So it should be at /api/v1/
    // Wait, the previous test failed because it expected 'Hello World!' at '/' but got 404.
    // If we add the prefix, then '/' becomes '/api/v1/'.
    // If we DON'T add the prefix, then '/' is '/'.
    // The previous failure was: expected 'Hello World!', got 404.
    // This implies that WITHOUT the prefix configuration in the test, the route IS at '/'.
    // So why did it 404?
    // Maybe because of the AuthGuard?
    // Yes, APP_GUARD is provided in AppModule globally.
    // So all routes are protected unless marked @Public().
    // We marked AppController.getHello as @Public() in the previous step.

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        validateCustomDecorators: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    const server = app.getHttpServer() as unknown as import('http').Server;
    return request(server).get('/').expect(200).expect('Hello World!');
  });

  // Health endpoint is excluded from global prefix in main.ts, but handled by HealthController
  // which is imported in AppModule. We need to make sure we're testing the right path.
  // In app.module.ts, HealthModule is imported.
  // In health.controller.ts, @Controller() is used, with @Get('health') and @Get('ready').
  // So it should be at /health and /ready.
  it('/health (GET)', () => {
    const server = app.getHttpServer() as unknown as import('http').Server;
    return request(server).get('/health').expect(200);
  });

  it('/metrics (GET)', async () => {
    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server).get('/metrics').expect(200);
    expect(res.header['content-type']).toContain('text/plain');
    expect(res.text).toContain('http_requests_total');
  });
});
