/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const extractCookies = (header: string[] | string | undefined): string[] => {
  if (!header) {
    return [];
  }

  return Array.isArray(header) ? header : [header];
};

describe('Workspaces (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerCookie: string;
  let memberCookie: string;
  let outsiderCookie: string;
  let workspaceId: string;

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

    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.application.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();

    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'workspace-owner@test.com',
      password: 'Password123!',
      fullName: 'Workspace Owner',
      role: 'RECRUITER',
    });

    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'workspace-owner@test.com',
        password: 'Password123!',
      });

    const ownerCookies = extractCookies(ownerLogin.headers['set-cookie']);
    ownerCookie = ownerCookies.find((c) => c.startsWith('access_token')) ?? '';

    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'workspace-member@test.com',
      password: 'Password123!',
      fullName: 'Workspace Member',
      role: 'RECRUITER',
    });

    const memberLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'workspace-member@test.com',
        password: 'Password123!',
      });

    const memberCookies = extractCookies(memberLogin.headers['set-cookie']);
    memberCookie =
      memberCookies.find((c) => c.startsWith('access_token')) ?? '';

    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'workspace-outsider@test.com',
      password: 'Password123!',
      fullName: 'Workspace Outsider',
      role: 'RECRUITER',
    });

    const outsiderLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'workspace-outsider@test.com',
        password: 'Password123!',
      });

    const outsiderCookies = extractCookies(outsiderLogin.headers['set-cookie']);
    outsiderCookie =
      outsiderCookies.find((c) => c.startsWith('access_token')) ?? '';
  });
  afterAll(async () => {
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.application.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('POST /api/v1/workspaces', () => {
    it('should create a workspace and owner membership', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/workspaces')
        .set('Cookie', [ownerCookie])
        .send({
          name: 'TalentFlow Workspace',
          isBusiness: true,
        })
        .expect(201);

      expect(response.body).toMatchObject({
        status: 201,
        message: 'Success',
      });
      expect(response.body.data).toMatchObject({
        name: 'TalentFlow Workspace',
        isBusiness: true,
      });

      workspaceId = response.body.data.id;

      const ownerUser = await prisma.user.findUnique({
        where: { email: 'workspace-owner@test.com' },
      });

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: ownerUser?.id ?? '',
          },
        },
      });

      expect(membership).not.toBeNull();
      expect(membership?.role).toBe('OWNER');
      expect(membership?.status).toBe('ACTIVE');
    });
  });

  describe('POST /api/v1/workspaces/:id/members', () => {
    it('should add member when requester is owner', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set('Cookie', [ownerCookie])
        .send({ email: 'workspace-member@test.com' })
        .expect(201);

      expect(response.body).toHaveProperty('status', 201);
      expect(response.body).toHaveProperty('data.id');
      expect(response.body).toHaveProperty(
        'data.user.email',
        'workspace-member@test.com',
      );
    });

    it('should reject non-owner/admin from adding member', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set('Cookie', [memberCookie])
        .send({ email: 'workspace-owner@test.com' })
        .expect(403);
    });

    it('should reject adding member when workspace is not business', async () => {
      const personalWorkspace = await request(app.getHttpServer())
        .post('/api/v1/workspaces')
        .set('Cookie', [ownerCookie])
        .send({
          name: 'Personal Workspace',
          isBusiness: false,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${personalWorkspace.body.data.id}/members`)
        .set('Cookie', [ownerCookie])
        .send({ email: 'workspace-outsider@test.com' })
        .expect(403);
    });
  });

  describe('GET /api/v1/workspaces/:id/members', () => {
    it('should list active members for workspace member', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspaceId}/members`)
        .set('Cookie', [ownerCookie])
        .expect(200);

      expect(response.body).toHaveProperty('status', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should reject non-member from listing members', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspaceId}/members`)
        .set('Cookie', [outsiderCookie])
        .expect(403);
    });

    it('should return 404 when workspace does not exist', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/workspaces/00000000-0000-4000-8000-000000000999/members')
        .set('Cookie', [ownerCookie])
        .expect(404);
    });
  });

  describe('DELETE /api/v1/workspaces/:id/members/:userId', () => {
    it('should reject non-owner/admin from removing member', async () => {
      const targetUser = await prisma.user.findUnique({
        where: { email: 'workspace-owner@test.com' },
      });
      await request(app.getHttpServer())
        .delete(`/api/v1/workspaces/${workspaceId}/members/${targetUser?.id}`)
        .set('Cookie', [outsiderCookie])
        .expect(403);
    });

    it('should reject when attempting to remove the owner', async () => {
      const ownerUser = await prisma.user.findUnique({
        where: { email: 'workspace-owner@test.com' },
      });
      await request(app.getHttpServer())
        .delete(`/api/v1/workspaces/${workspaceId}/members/${ownerUser?.id}`)
        .set('Cookie', [memberCookie])
        .expect(403);
    });

    it('should allow owner to remove member', async () => {
      const targetUser = await prisma.user.findUnique({
        where: { email: 'workspace-member@test.com' },
      });
      await request(app.getHttpServer())
        .delete(`/api/v1/workspaces/${workspaceId}/members/${targetUser?.id}`)
        .set('Cookie', [ownerCookie])
        .expect(204);

      // Verify soft delete status is REMOVED
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: targetUser?.id ?? '',
          },
        },
      });
      expect(membership?.status).toBe('REMOVED');
    });

    it('should return 404 if member does not exist or already removed', async () => {
      const targetUser = await prisma.user.findUnique({
        where: { email: 'workspace-member@test.com' },
      });
      await request(app.getHttpServer())
        .delete(`/api/v1/workspaces/${workspaceId}/members/${targetUser?.id}`)
        .set('Cookie', [ownerCookie])
        .expect(404);
    });
  });
});
