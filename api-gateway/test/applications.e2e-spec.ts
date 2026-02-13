import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ApplicationStatus, JobStatus, EmploymentType } from '@prisma/client';

const extractCookies = (header: string[] | string | undefined): string[] => {
  if (!header) {
    return [];
  }

  return Array.isArray(header) ? header : [header];
};

describe('Applications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let applicantCookie: string;
  let recruiterCookie: string;
  let jobId: string;
  let applicationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global prefix as in main.ts
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

    // Clean up
    await prisma.application.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();

    // Create recruiter
    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'apps-recruiter@test.com',
      password: 'Password123!',
      fullName: 'Apps Test Recruiter',
      role: 'RECRUITER',
    });

    const recruiterLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'apps-recruiter@test.com',
        password: 'Password123!',
      });

    const recruiterRawCookies = recruiterLogin.headers['set-cookie'];
    const recruiterCookies = extractCookies(recruiterRawCookies);
    recruiterCookie =
      recruiterCookies.find((c) => c.startsWith('access_token')) ?? '';

    // Create applicant
    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'apps-applicant@test.com',
      password: 'Password123!',
      fullName: 'Apps Test Applicant',
      role: 'RECRUITER',
    });

    const applicantLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'apps-applicant@test.com',
        password: 'Password123!',
      });

    const applicantRawCookies = applicantLogin.headers['set-cookie'];
    const applicantCookies = extractCookies(applicantRawCookies);
    applicantCookie =
      applicantCookies.find((c) => c.startsWith('access_token')) ?? '';

    // Create a test job
    const jobResponse = await request(app.getHttpServer())
      .post('/api/v1/jobs')
      .set('Cookie', [recruiterCookie])
      .send({
        title: 'Senior Developer',
        description: 'Test job',
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

  describe('POST /api/v1/applications', () => {
    it('should create an application', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Cookie', [applicantCookie])
        .send({
          jobId,
          coverLetter: 'I am interested in this position',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        jobId,
        candidateId: expect.any(String),
        stage: expect.any(String),
        status: ApplicationStatus.SUBMITTED,
      });

      applicationId = response.body.id;
    });

    it('should return 409 if already applied', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Cookie', [applicantCookie])
        .send({ jobId })
        .expect(409);
    });
  });

  describe('GET /api/v1/applications', () => {
    it('should get applications for applicant', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/applications')
        .set('Cookie', [applicantCookie])
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should get applications for recruiter (their jobs)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/applications')
        .set('Cookie', [recruiterCookie])
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('PUT /api/v1/applications/:id', () => {
    it('should allow recruiter to update application status', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/applications/${applicationId}`)
        .set('Cookie', [recruiterCookie])
        .send({
          status: ApplicationStatus.REVIEWING,
          notes: 'Good candidate',
        })
        .expect(200);

      expect(response.body.status).toBe(ApplicationStatus.REVIEWING);
      expect(response.body.notes).toBe('Good candidate');
    });
  });

  describe('DELETE /api/v1/applications/:id', () => {
    it('should allow applicant to withdraw application', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/applications/${applicationId}`)
        .set('Cookie', [applicantCookie])
        .expect(204);

      const application = await prisma.application.findUnique({
        where: { id: applicationId },
      });

      expect(application?.deletedAt).not.toBeNull();
      expect(application?.status).toBe('WITHDRAWN');
    });
  });
});
