/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
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

interface JobResponse {
  id: string;
  title: string;
  description: string;
  department?: string;
  location?: string;
  employmentType: EmploymentType;
  salaryMin?: number;
  salaryMax?: number;
  status: JobStatus;
  requirements?: { skills?: string[] };
}

describe('Jobs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let recruiterCookie: string;
  let jobId: string;
  let recruiterId: string;

  // Test job data for filter tests
  const testJobs = [
    {
      title: 'Junior Developer',
      description: 'Entry level position',
      department: 'Engineering',
      location: 'Remote',
      employmentType: EmploymentType.FULL_TIME,
      salaryMin: 40000,
      salaryMax: 60000,
      status: JobStatus.OPEN,
      requirements: { skills: ['javascript', 'html', 'css'] },
    },
    {
      title: 'Senior Full Stack Developer',
      description: 'Experienced developer needed',
      department: 'Engineering',
      location: 'New York',
      employmentType: EmploymentType.FULL_TIME,
      salaryMin: 100000,
      salaryMax: 150000,
      status: JobStatus.OPEN,
      requirements: { skills: ['typescript', 'nestjs', 'react', 'postgresql'] },
    },
    {
      title: 'DevOps Engineer',
      description: 'Cloud infrastructure expert',
      department: 'Operations',
      location: 'San Francisco',
      employmentType: EmploymentType.CONTRACT,
      salaryMin: 120000,
      salaryMax: 180000,
      status: JobStatus.OPEN,
      requirements: { skills: ['kubernetes', 'docker', 'aws', 'terraform'] },
    },
    {
      title: 'Part-time QA Tester',
      description: 'Quality assurance role',
      department: 'Quality',
      location: 'Remote',
      employmentType: EmploymentType.PART_TIME,
      salaryMin: 30000,
      salaryMax: 45000,
      status: JobStatus.CLOSED,
      requirements: { skills: ['testing', 'selenium', 'javascript'] },
    },
  ];

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
    const signupResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        email: 'jobs-recruiter@test.com',
        password: 'Password123!',
        fullName: 'Jobs Test Recruiter',
        role: 'RECRUITER',
      });

    recruiterId = signupResponse.body.user.id;

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'jobs-recruiter@test.com',
        password: 'Password123!',
      });

    const rawCookies = loginResponse.headers['set-cookie'];
    const cookies = extractCookies(rawCookies);
    recruiterCookie = cookies.find((c) => c.startsWith('access_token')) ?? '';

    // Create test jobs for filter tests
    for (const job of testJobs) {
      await prisma.job.create({
        data: {
          ...job,
          createdById: recruiterId,
        },
      });
    }
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
        response.body.data.every(
          (job: JobResponse) => job.status === JobStatus.OPEN,
        ),
      ).toBe(true);
    });

    describe('Salary Filters', () => {
      it('should filter jobs by salaryMin (jobs with salaryMax >= salaryMin)', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/jobs')
          .query({ salaryMin: 100000 })
          .expect(200);

        // All returned jobs should have salaryMax >= 100000
        const jobs = response.body.data as JobResponse[];
        expect(jobs.length).toBeGreaterThan(0);
        jobs.forEach((job) => {
          expect(job.salaryMax).toBeGreaterThanOrEqual(100000);
        });
      });

      it('should filter jobs by salaryMax (jobs with salaryMin <= salaryMax)', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/jobs')
          .query({ salaryMax: 50000 })
          .expect(200);

        // All returned jobs should have salaryMin <= 50000
        const jobs = response.body.data as JobResponse[];
        expect(jobs.length).toBeGreaterThan(0);
        jobs.forEach((job) => {
          expect(job.salaryMin).toBeLessThanOrEqual(50000);
        });
      });

      it('should filter jobs by salary range (overlap)', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/jobs')
          .query({ salaryMin: 80000, salaryMax: 130000 })
          .expect(200);

        // Jobs with salary range overlapping 80k-130k
        // Senior Dev (100k-150k) and DevOps (120k-180k) should match
        const jobs = response.body.data as JobResponse[];
        expect(jobs.length).toBeGreaterThan(0);
        jobs.forEach((job) => {
          // Job's max should be >= our min AND job's min should be <= our max
          expect(job.salaryMax).toBeGreaterThanOrEqual(80000);
          expect(job.salaryMin).toBeLessThanOrEqual(130000);
        });
      });

      it('should return no jobs when salary range has no overlap', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/jobs')
          .query({ salaryMin: 200000, salaryMax: 300000 })
          .expect(200);

        // No jobs in the 200k-300k range
        expect(response.body.data.length).toBe(0);
      });
    });

    describe('Skills Filters', () => {
      it('should filter jobs by single skill', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/jobs')
          .query({ skills: 'typescript' })
          .expect(200);

        const jobs = response.body.data as JobResponse[];
        expect(jobs.length).toBeGreaterThan(0);
        // All jobs should have typescript in their skills
        jobs.forEach((job) => {
          const skills = job.requirements?.skills?.map((s) => s.toLowerCase());
          expect(skills).toContain('typescript');
        });
      });

      it('should filter jobs by multiple skills (comma-separated)', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/jobs')
          .query({ skills: 'nestjs,postgresql' })
          .expect(200);

        const jobs = response.body.data as JobResponse[];
        expect(jobs.length).toBeGreaterThan(0);
        // All jobs should have both nestjs and postgresql
        jobs.forEach((job) => {
          const skills = job.requirements?.skills?.map((s) => s.toLowerCase());
          expect(skills).toContain('nestjs');
          expect(skills).toContain('postgresql');
        });
      });

      it('should return no jobs when skill does not exist', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/jobs')
          .query({ skills: 'cobol' })
          .expect(200);

        expect(response.body.data.length).toBe(0);
      });
    });

    describe('Search Filters', () => {
      it('should search jobs by title', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/jobs')
          .query({ search: 'Developer' })
          .expect(200);

        const jobs = response.body.data as JobResponse[];
        expect(jobs.length).toBeGreaterThan(0);
        jobs.forEach((job) => {
          expect(
            job.title.toLowerCase().includes('developer') ||
              job.description.toLowerCase().includes('developer'),
          ).toBe(true);
        });
      });

      it('should search jobs by description', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/jobs')
          .query({ search: 'infrastructure' })
          .expect(200);

        const jobs = response.body.data as JobResponse[];
        expect(jobs.length).toBeGreaterThan(0);
        jobs.forEach((job) => {
          expect(
            job.title.toLowerCase().includes('infrastructure') ||
              job.description.toLowerCase().includes('infrastructure'),
          ).toBe(true);
        });
      });
    });

    describe('Sorting', () => {
      it('should sort jobs by salaryMin ascending', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/jobs')
          .query({ sortBy: 'salaryMin', sortOrder: 'asc', status: 'OPEN' })
          .expect(200);

        const jobs = response.body.data as JobResponse[];
        // Filter out jobs with null salaryMin for proper comparison
        const jobsWithSalary = jobs.filter((j) => j.salaryMin !== null);
        expect(jobsWithSalary.length).toBeGreaterThan(1);

        for (let i = 1; i < jobsWithSalary.length; i++) {
          expect(jobsWithSalary[i].salaryMin).toBeGreaterThanOrEqual(
            jobsWithSalary[i - 1].salaryMin ?? 0,
          );
        }
      });

      it('should sort jobs by salaryMin descending', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/jobs')
          .query({ sortBy: 'salaryMin', sortOrder: 'desc', status: 'OPEN' })
          .expect(200);

        const jobs = response.body.data as JobResponse[];
        // Filter out jobs with null salaryMin for proper comparison
        const jobsWithSalary = jobs.filter((j) => j.salaryMin !== null);
        expect(jobsWithSalary.length).toBeGreaterThan(1);

        for (let i = 1; i < jobsWithSalary.length; i++) {
          expect(jobsWithSalary[i].salaryMin).toBeLessThanOrEqual(
            jobsWithSalary[i - 1].salaryMin ?? Infinity,
          );
        }
      });

      it('should sort jobs by title', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/jobs')
          .query({ sortBy: 'title', sortOrder: 'asc', status: 'OPEN' })
          .expect(200);

        const jobs = response.body.data as JobResponse[];
        expect(jobs.length).toBeGreaterThan(1);

        for (let i = 1; i < jobs.length; i++) {
          expect(
            jobs[i].title.localeCompare(jobs[i - 1].title),
          ).toBeGreaterThanOrEqual(0);
        }
      });
    });

    describe('Combined Filters', () => {
      it('should combine status and salary filters', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/jobs')
          .query({
            status: JobStatus.OPEN,
            salaryMin: 50000,
            salaryMax: 160000,
          })
          .expect(200);

        const jobs = response.body.data as JobResponse[];
        jobs.forEach((job) => {
          expect(job.status).toBe(JobStatus.OPEN);
          expect(job.salaryMax).toBeGreaterThanOrEqual(50000);
          expect(job.salaryMin).toBeLessThanOrEqual(160000);
        });
      });

      it('should combine employmentType and salary filters', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/jobs')
          .query({
            employmentType: EmploymentType.FULL_TIME,
            salaryMin: 80000,
          })
          .expect(200);

        const jobs = response.body.data as JobResponse[];
        jobs.forEach((job) => {
          expect(job.employmentType).toBe(EmploymentType.FULL_TIME);
          expect(job.salaryMax).toBeGreaterThanOrEqual(80000);
        });
      });
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
