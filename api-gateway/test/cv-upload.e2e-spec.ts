/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JobStatus, EmploymentType } from '@prisma/client';

const extractCookies = (header: string[] | string | undefined): string[] => {
  if (!header) {
    return [];
  }

  return Array.isArray(header) ? header : [header];
};

describe('CV Upload (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let applicantCookie: string;
  let recruiterCookie: string;
  let jobId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready', 'metrics'] });

    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    await prisma.application.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();

    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'cv-recruiter@test.com',
      password: 'Password123!',
      fullName: 'CV Test Recruiter',
      role: 'RECRUITER',
    });

    const recruiterLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'cv-recruiter@test.com',
        password: 'Password123!',
      });

    const recruiterCookies = extractCookies(
      recruiterLogin.headers['set-cookie'],
    );
    recruiterCookie =
      recruiterCookies.find((c) => c.startsWith('access_token')) ?? '';

    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'cv-applicant@test.com',
      password: 'Password123!',
      fullName: 'CV Test Applicant',
      role: 'RECRUITER',
    });

    const applicantLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'cv-applicant@test.com',
        password: 'Password123!',
      });

    const applicantCookies = extractCookies(
      applicantLogin.headers['set-cookie'],
    );
    applicantCookie =
      applicantCookies.find((c) => c.startsWith('access_token')) ?? '';

    const jobResponse = await request(app.getHttpServer())
      .post('/api/v1/jobs')
      .set('Cookie', [recruiterCookie])
      .send({
        title: 'CV Upload Job',
        description: 'Test job for cv upload',
        employmentType: EmploymentType.FULL_TIME,
        status: JobStatus.OPEN,
      });

    jobId = jobResponse.body.id;
  });

  afterAll(async () => {
    await prisma.application.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('POST /api/v1/applications/upload', () => {
    it('should upload PDF CV and create application', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/applications/upload')
        .set('Cookie', [applicantCookie])
        .field('jobId', jobId)
        .field('coverLetter', 'CV upload test')
        .attach('file', Buffer.from('%PDF-1.4 test'), {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        applicationId: expect.any(String),
        fileKey: expect.any(String),
        fileUrl: expect.any(String),
        status: 'processing',
      });
    });

    it('should reject invalid MIME type', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/applications/upload')
        .set('Cookie', [applicantCookie])
        .field('jobId', jobId)
        .attach('file', Buffer.from('not allowed'), {
          filename: 'malware.exe',
          contentType: 'application/x-msdownload',
        })
        .expect(400);
    });

    it('should reject duplicate application', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/applications/upload')
        .set('Cookie', [applicantCookie])
        .field('jobId', jobId)
        .attach('file', Buffer.from('%PDF-1.4 duplicate'), {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        })
        .expect(409);
    });

    it('should reject when job does not exist', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/applications/upload')
        .set('Cookie', [recruiterCookie])
        .field('jobId', 'f47ac10b-58cc-4372-a567-0e02b2c3d479')
        .attach('file', Buffer.from('%PDF-1.4 test'), {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        })
        .expect(404);
    });
  });
});
