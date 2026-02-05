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

  it('/ (GET)', () => {
    const server = app.getHttpServer() as unknown as import('http').Server;
    return request(server).get('/').expect(200).expect('Hello World!');
  });

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
