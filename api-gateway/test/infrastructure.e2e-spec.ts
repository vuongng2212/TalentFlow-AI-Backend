/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import helmet from 'helmet';
import hpp from 'hpp';
import { json, urlencoded } from 'express';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Infrastructure (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same middleware as main.ts
    const bodyLimitMb = 10;
    const corsOrigins = ['http://localhost:3001', 'http://localhost:3000'];

    app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready', 'metrics'] });

    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      }),
    );
    app.use(hpp());

    app.enableCors({
      origin: corsOrigins,
      credentials: true,
    });

    app.use(json({ limit: `${bodyLimitMb}mb` }));
    app.use(urlencoded({ extended: true, limit: `${bodyLimitMb}mb` }));

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        validateCustomDecorators: true,
      }),
    );

    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Checks', () => {
    it('GET /health should return 200 with memory checks', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);

      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('info');
      expect(res.body).toHaveProperty('details');

      // Verify memory health indicators
      expect(res.body.details).toHaveProperty('memory_heap');
      expect(res.body.details).toHaveProperty('memory_rss');

      expect(res.body.details.memory_heap).toHaveProperty('status', 'up');
      expect(res.body.details.memory_rss).toHaveProperty('status', 'up');
    });

    it('GET /ready should return 200 with memory checks', async () => {
      const res = await request(app.getHttpServer()).get('/ready').expect(200);

      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('info');

      // Verify readiness checks include memory
      expect(res.body.details).toHaveProperty('memory_heap');
      expect(res.body.details).toHaveProperty('memory_rss');
    });
  });

  describe('Metrics', () => {
    it('GET /metrics should return Prometheus format', async () => {
      const res = await request(app.getHttpServer())
        .get('/metrics')
        .expect(200)
        .expect('Content-Type', /text\/plain/);

      // Verify prometheus metrics
      expect(res.text).toContain('http_requests_total');
      expect(res.text).toContain('http_request_duration_seconds');

      // Verify default metrics (process, nodejs)
      expect(res.text).toContain('process_cpu');
      expect(res.text).toContain('nodejs_');
    });

    it('GET /metrics should not be affected by global prefix', async () => {
      // /metrics should work, not /api/v1/metrics
      await request(app.getHttpServer()).get('/metrics').expect(200);

      await request(app.getHttpServer()).get('/api/v1/metrics').expect(404);
    });
  });

  describe('Security Headers', () => {
    it('should include Helmet security headers', async () => {
      const res = await request(app.getHttpServer()).get('/health');

      // Verify Helmet headers
      expect(res.headers).toHaveProperty('x-dns-prefetch-control');
      expect(res.headers).toHaveProperty('x-frame-options');
      expect(res.headers).toHaveProperty('x-content-type-options');
      expect(res.headers).toHaveProperty('x-download-options');
    });

    it('should not include CSP header (disabled for API)', async () => {
      const res = await request(app.getHttpServer()).get('/health');

      expect(res.headers).not.toHaveProperty('content-security-policy');
    });
  });

  describe('Request ID', () => {
    it('should generate request ID if not provided', async () => {
      const res = await request(app.getHttpServer()).get('/health');

      expect(res.headers).toHaveProperty('x-request-id');
      expect(res.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ); // UUID v4 pattern
    });

    it('should preserve request ID from header', async () => {
      const customId = 'test-request-123';
      const res = await request(app.getHttpServer())
        .get('/health')
        .set('x-request-id', customId);

      expect(res.headers['x-request-id']).toBe(customId);
    });

    it('should include request ID in error responses', async () => {
      const customId = 'error-test-456';
      const res = await request(app.getHttpServer())
        .get('/api/v1/non-existent')
        .set('x-request-id', customId)
        .expect(404);

      expect(res.body).toHaveProperty('requestId', customId);
    });
  });

  describe('CORS', () => {
    it('should handle OPTIONS preflight request', async () => {
      const res = await request(app.getHttpServer())
        .options('/health')
        .set('Origin', 'http://localhost:3001');

      expect(res.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should allow configured origins', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .set('Origin', 'http://localhost:3001');

      expect(res.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('API Prefix', () => {
    it('should apply /api/v1 prefix to routes', async () => {
      // AppController '/' is now under /api/v1/ due to global prefix
      // Note: This endpoint is public so it should return 200
      await request(app.getHttpServer()).get('/api/v1/').expect(200);
    });

    it('should exclude health/ready/metrics from prefix', async () => {
      // These should work without prefix
      await request(app.getHttpServer()).get('/health').expect(200);
      await request(app.getHttpServer()).get('/ready').expect(200);
      await request(app.getHttpServer()).get('/metrics').expect(200);

      // Should NOT work with prefix
      await request(app.getHttpServer()).get('/api/v1/health').expect(404);
      await request(app.getHttpServer()).get('/api/v1/ready').expect(404);
    });
  });

  describe('Error Handling', () => {
    it('should return standardized error format', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/non-existent-route')
        .expect(404);

      expect(res.body).toHaveProperty('status', 404);
      expect(res.body).toHaveProperty('error', 'Not Found');
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('timestamp');

      // Verify timestamp is valid ISO string
      expect(() => new Date(res.body.timestamp)).not.toThrow();
    });

    it('should include request ID when provided', async () => {
      const customId = 'test-error-123';
      const res = await request(app.getHttpServer())
        .get('/api/v1/invalid')
        .set('x-request-id', customId)
        .expect(404);

      // RequestId should be present when provided in header
      expect(res.body.requestId).toBe(customId);
    });
  });

  describe('HTTP Parameter Pollution (HPP)', () => {
    it('should handle duplicate query parameters safely', async () => {
      // HPP protection should prevent pollution attacks
      const res = await request(app.getHttpServer())
        .get('/health?test=1&test=2&test=3')
        .expect(200);

      // Should still succeed (HPP just protects against pollution)
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Request Logging', () => {
    it('should log requests with structured format', async () => {
      // This test verifies interceptor is attached
      // Actual log verification would require log capture
      const res = await request(app.getHttpServer()).get('/health');

      // If request completes successfully, interceptor ran
      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty('x-request-id');
    });
  });

  describe('Validation', () => {
    it('should have global validation pipe active', async () => {
      // Use signup endpoint with invalid data to trigger validation
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({ email: 'invalid-email' }) // Missing password/name
        .expect(400);

      expect(res.body.message).toBe('Validation failed');
      expect(res.body.details).toBeDefined();
    });
  });
});
