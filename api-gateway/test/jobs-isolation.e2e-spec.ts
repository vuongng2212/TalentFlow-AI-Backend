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

describe('Jobs Isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let userACookie: string;
  let userBCookie: string;

  let workspaceAId: string;
  let workspaceBId: string;

  let jobAId: string;
  let jobBId: string;

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
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    // User A Signup
    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'user-a@test.com',
      password: 'Password123!',
      fullName: 'User A',
      role: 'RECRUITER',
    });

    const loginA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'user-a@test.com',
        password: 'Password123!',
      });
    userACookie =
      extractCookies(loginA.headers['set-cookie']).find((c) =>
        c.startsWith('access_token'),
      ) ?? '';

    // User B Signup
    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'user-b@test.com',
      password: 'Password123!',
      fullName: 'User B',
      role: 'RECRUITER',
    });

    const loginB = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'user-b@test.com',
        password: 'Password123!',
      });
    userBCookie =
      extractCookies(loginB.headers['set-cookie']).find((c) =>
        c.startsWith('access_token'),
      ) ?? '';

    // Create Workspace A
    const resWA = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', [userACookie])
      .send({ name: 'Workspace A', isBusiness: true });

    workspaceAId = resWA.body.data?.id || resWA.body.id;

    // Create Workspace B
    const resWB = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', [userBCookie])
      .send({ name: 'Workspace B', isBusiness: true });

    workspaceBId = resWB.body.data?.id || resWB.body.id;
  });

  afterAll(async () => {
    await prisma.application.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.job.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('Job Creation Isolation', () => {
    it('should create Job A in Workspace A using x-workspace-id header', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/jobs')
        .set('Cookie', [userACookie])
        .set('x-workspace-id', workspaceAId)
        .send({
          title: 'Job A',
          description: 'Job in Workspace A',
          employmentType: EmploymentType.FULL_TIME,
          status: JobStatus.OPEN,
        })
        .expect(201);

      jobAId = response.body.id;

      // Verify in DB
      const job = await prisma.job.findUnique({ where: { id: jobAId } });
      expect(job?.workspaceId).toBe(workspaceAId);
    });

    it('should create Job B in Workspace B using x-workspace-id header', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/jobs')
        .set('Cookie', [userBCookie])
        .set('x-workspace-id', workspaceBId)
        .send({
          title: 'Job B',
          description: 'Job in Workspace B',
          employmentType: EmploymentType.FULL_TIME,
          status: JobStatus.OPEN,
        })
        .expect(201);

      jobBId = response.body.id;

      const job = await prisma.job.findUnique({ where: { id: jobBId } });
      expect(job?.workspaceId).toBe(workspaceBId);
    });
  });

  describe('Job Retrieval Isolation', () => {
    it('User A should only see Job A when querying Workspace A', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/jobs')
        .set('Cookie', [userACookie])
        .set('x-workspace-id', workspaceAId)
        .expect(200);

      const jobs = response.body.data;
      expect(jobs.length).toBe(1);
      expect(jobs[0].id).toBe(jobAId);
      expect(jobs[0].title).toBe('Job A');
    });

    it('User B should only see Job B when querying Workspace B', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/jobs')
        .set('Cookie', [userBCookie])
        .set('x-workspace-id', workspaceBId)
        .expect(200);

      const jobs = response.body.data;
      expect(jobs.length).toBe(1);
      expect(jobs[0].id).toBe(jobBId);
      expect(jobs[0].title).toBe('Job B');
    });

    it('User A cannot fetch Job B details directly and receives 404', async () => {
      // Trying to fetch Job B while in Workspace A context
      await request(app.getHttpServer())
        .get(`/api/v1/jobs/${jobBId}`)
        .set('Cookie', [userACookie])
        .set('x-workspace-id', workspaceAId)
        .expect(404);
    });

    it('User A cannot access Workspace B if not a member (non-public endpoint)', async () => {
      // Trying to set context to Workspace B without being a member should return Forbidden (403)
      await request(app.getHttpServer())
        .post('/api/v1/jobs')
        .set('Cookie', [userACookie])
        .set('x-workspace-id', workspaceBId)
        .send({
          title: 'Hacked Job in Workspace B',
          description: 'Hacked',
          employmentType: EmploymentType.FULL_TIME,
          status: JobStatus.OPEN,
        })
        .expect(403);
    });
  });

  describe('Job Mutation Isolation', () => {
    it('User A cannot update Job B directly', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/jobs/${jobBId}`)
        .set('Cookie', [userACookie])
        .set('x-workspace-id', workspaceAId)
        .send({ title: 'Hacked Job B' })
        .expect(404);
    });

    it('User A cannot delete Job B directly', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/jobs/${jobBId}`)
        .set('Cookie', [userACookie])
        .set('x-workspace-id', workspaceAId)
        .expect(404);
    });

    it('User A can update Job A in Workspace A', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/jobs/${jobAId}`)
        .set('Cookie', [userACookie])
        .set('x-workspace-id', workspaceAId)
        .send({ title: 'Job A Updated' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${jobAId}`)
        .set('Cookie', [userACookie])
        .set('x-workspace-id', workspaceAId)
        .expect(200);

      expect(response.body.title).toBe('Job A Updated');
    });
  });
});
