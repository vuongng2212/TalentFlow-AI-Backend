import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const extractCookies = (header: string[] | string | undefined): string[] => {
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
};

describe('Workspace Switching (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let userCookie: string;
  let userId: string;

  let workspace1Id: string;
  let workspace2Id: string;

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

    // Clean up
    await prisma.application.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.job.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    // Signup (this should automatically create a default Personal Workspace per T021)
    const signupRes = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        email: 'switcher@test.com',
        password: 'Password123!',
        fullName: 'Switcher',
        role: 'RECRUITER',
      });

    userId = (signupRes.body.user?.id ||
      signupRes.body.id ||
      (await prisma.user.findUnique({ where: { email: 'switcher@test.com' } }))
        ?.id ||
      '') as string;

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'switcher@test.com',
        password: 'Password123!',
      });
    userCookie =
      extractCookies(loginRes.headers['set-cookie']).find((c) =>
        c.startsWith('access_token'),
      ) ?? '';

    const userInDb = await prisma.user.findUnique({ where: { id: userId } });
    if (!userInDb?.activeWorkspaceId) {
      throw new Error('User did not get an active workspace provisioned');
    }
    workspace1Id = userInDb.activeWorkspaceId;

    // Create a second workspace
    const resW2 = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', [userCookie])
      .send({ name: 'Business Workspace', isBusiness: true });

    workspace2Id = (resW2.body.data?.id || resW2.body.id) as string;
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

  describe('Context Fallback (Default active workspace)', () => {
    beforeAll(async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { activeWorkspaceId: workspace1Id },
      });
    });
    it('should use active workspace as fallback when x-workspace-id header is absent', async () => {
      // Create a job without header

      const jobRes = await request(app.getHttpServer())
        .post('/api/v1/jobs')
        .set('Cookie', [userCookie])
        .send({
          title: 'Job 1',
          description: 'Job in default workspace',
          employmentType: 'FULL_TIME',
          status: 'OPEN',
        })
        .expect(201);

      const jobId = jobRes.body.id as string;
      const jobInDb = await prisma.job.findUnique({ where: { id: jobId } });

      // Should fall back to workspace1Id
      expect(jobInDb?.workspaceId).toBe(workspace1Id);
    });
  });

  describe('PATCH /api/v1/users/active-workspace', () => {
    it('should update active workspace to Workspace 2', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/active-workspace')
        .set('Cookie', [userCookie])
        .send({ workspaceId: workspace2Id });

      expect(res.status).toBe(200);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.activeWorkspaceId).toBe(workspace2Id);
    });

    it('subsequent requests without header should now use Workspace 2', async () => {
      // Create a job without header

      const jobRes = await request(app.getHttpServer())
        .post('/api/v1/jobs')
        .set('Cookie', [userCookie])
        .send({
          title: 'Job 2',
          description: 'Job in switched workspace',
          employmentType: 'FULL_TIME',
          status: 'OPEN',
        })
        .expect(201);

      const jobId = jobRes.body.id as string;
      const jobInDb = await prisma.job.findUnique({ where: { id: jobId } });

      // Should fall back to workspace2Id
      expect(jobInDb?.workspaceId).toBe(workspace2Id);
    });

    it('should reject switching to a workspace where user is not a member', async () => {
      const randomId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .patch('/api/v1/users/active-workspace')
        .set('Cookie', [userCookie])
        .send({ workspaceId: randomId })
        .expect(403);
    });
  });
});
