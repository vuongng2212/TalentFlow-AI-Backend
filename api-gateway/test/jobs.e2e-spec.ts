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

describe('Jobs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let recruiterCookie: string;
  let jobId: string;

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

    // Create test users
    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'jobs-recruiter@test.com',
      password: 'Password123!',
      fullName: 'Jobs Test Recruiter',
      role: 'RECRUITER',
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'jobs-recruiter@test.com',
        password: 'Password123!',
      });

    const rawCookies = loginResponse.headers['set-cookie'];
    const cookies = extractCookies(rawCookies);
    recruiterCookie = cookies.find((c) => c.startsWith('access_token')) ?? '';
  });

  afterAll(async () => {
    await prisma.application.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('POST /api/v1/jobs', () => {
    it('should create a new job as recruiter', async () => {
      const createJobDto = {
        title: 'Senior Full Stack Developer',
        description: 'We are looking for an experienced developer',
        department: 'Engineering',
        location: 'Remote',
        employmentType: EmploymentType.FULL_TIME,
        salaryMin: 80000,
        salaryMax: 120000,
        status: JobStatus.OPEN,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/jobs')
        .set('Cookie', [recruiterCookie])
        .send(createJobDto)
        .expect(201);

      expect(response.body).toMatchObject({
        title: createJobDto.title,
        description: createJobDto.description,
        status: JobStatus.OPEN,
      });

      jobId = response.body.id;
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/jobs')
        .send({ title: 'Test Job' })
        .expect(401);
    });
  });

  describe('GET /api/v1/jobs', () => {
    it('should get all jobs with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/jobs')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toMatchObject({
        page: 1,
        limit: 10,
      });
    });

    it('should filter jobs by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/jobs')
        .query({ status: JobStatus.OPEN })
        .expect(200);

      expect(
        response.body.data.every((job: any) => job.status === JobStatus.OPEN),
      ).toBe(true);
    });
  });

  describe('GET /api/v1/jobs/:id', () => {
    it('should get a job by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${jobId}`)
        .expect(200);

      expect(response.body.id).toBe(jobId);
    });

    it('should return 404 for non-existent job', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/jobs/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PUT /api/v1/jobs/:id', () => {
    it('should update a job as owner', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/jobs/${jobId}`)
        .set('Cookie', [recruiterCookie])
        .send({ title: 'Updated Job Title' })
        .expect(200);

      expect(response.body.title).toBe('Updated Job Title');
    });
  });

  describe('DELETE /api/v1/jobs/:id', () => {
    it('should soft delete a job as owner', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/jobs/${jobId}`)
        .set('Cookie', [recruiterCookie])
        .expect(204);

      // Verify soft delete
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.deletedAt).not.toBeNull();
    });
  });
});
