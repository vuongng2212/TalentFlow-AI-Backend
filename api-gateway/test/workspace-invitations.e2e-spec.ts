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

describe('Workspace Invitations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ownerCookie: string;
  let workspaceId: string;

  const inviteeEmail = 'invitee@test.com';

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

    // Signup owner
    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email: 'owner@test.com',
      password: 'Password123!',
      fullName: 'Owner',
      role: 'RECRUITER',
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner@test.com',
        password: 'Password123!',
      });
    ownerCookie =
      extractCookies(loginRes.headers['set-cookie']).find((c) =>
        c.startsWith('access_token'),
      ) ?? '';

    // Create business workspace
    const createWsRes = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', [ownerCookie])
      .send({ name: 'Business Workspace', isBusiness: true });

    workspaceId = (createWsRes.body.data?.id || createWsRes.body.id) as string;
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

  describe('Workspace Invitation Flow', () => {
    let invitationToken: string;

    it('should generate an invitation token and create INVITED membership', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/invitations`)
        .set('Cookie', [ownerCookie])
        .send({ email: inviteeEmail, role: 'RECRUITER' });

      expect(res.status).toBe(201);

      const invitation = await prisma.workspaceInvitation.findFirst({
        where: {
          workspaceId,
          email: inviteeEmail,
        },
      });

      expect(invitation).toBeDefined();
      expect(invitation?.token).toBeDefined();

      invitationToken = invitation!.token!;
    });

    it('should register and accept the invitation simultaneously', async () => {
      // Signup invitee
      const signupRes = await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          email: inviteeEmail,
          password: 'Password123!',
          fullName: 'Invitee',
          role: 'RECRUITER',
        });

      const inviteeId = (signupRes.body.user?.id ||
        signupRes.body.id ||
        (await prisma.user.findUnique({ where: { email: inviteeEmail } }))
          ?.id ||
        '') as string;

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: inviteeEmail,
          password: 'Password123!',
        });
      const inviteeCookie =
        extractCookies(loginRes.headers['set-cookie']).find((c) =>
          c.startsWith('access_token'),
        ) ?? '';

      // Accept invitation
      const acceptRes = await request(app.getHttpServer())
        .post('/api/v1/workspaces/invitations/accept')
        .set('Cookie', [inviteeCookie])
        .send({ token: invitationToken });

      expect(acceptRes.status).toBe(200);

      const membership = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId: inviteeId,
        },
      });

      expect(membership).toBeDefined();
      expect(membership?.status).toBe('ACTIVE');

      const updatedUser = await prisma.user.findUnique({
        where: { id: inviteeId },
      });
      expect(updatedUser?.activeWorkspaceId).toBe(workspaceId);

      const deletedInvitation = await prisma.workspaceInvitation.findUnique({
        where: { token: invitationToken },
      });
      expect(deletedInvitation).toBeNull();
    });
  });
});
