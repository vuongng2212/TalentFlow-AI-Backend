/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PlanCode,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const extractCookie = (header: string[] | string | undefined): string => {
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  return cookies.find((cookie) => cookie.startsWith('access_token')) ?? '';
};

describe('Subscriptions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let workspaceId: string;
  let ownerCookie: string;
  let adminCookie: string;
  let recruiterCookie: string;
  let viewerCookie: string;
  let outsiderCookie: string;

  const users = [
    {
      key: 'owner',
      email: 'subscription-owner@test.com',
      fullName: 'Plan Owner',
    },
    {
      key: 'admin',
      email: 'subscription-admin@test.com',
      fullName: 'Plan Admin',
    },
    {
      key: 'recruiter',
      email: 'subscription-recruiter@test.com',
      fullName: 'Plan Recruiter',
    },
    {
      key: 'viewer',
      email: 'subscription-viewer@test.com',
      fullName: 'Plan Viewer',
    },
    {
      key: 'outsider',
      email: 'subscription-outsider@test.com',
      fullName: 'Plan Outsider',
    },
  ] as const;

  const cleanFixtures = async () => {
    const persistedUsers = await prisma.user.findMany({
      where: { email: { in: users.map((user) => user.email) } },
      select: { id: true },
    });
    const userIds = persistedUsers.map((user) => user.id);
    const personalWorkspaces = await prisma.workspace.findMany({
      where: { createdById: { in: userIds } },
      select: { id: true },
    });
    const workspaceIds = [
      ...personalWorkspaces.map((workspace) => workspace.id),
      ...(workspaceId ? [workspaceId] : []),
    ];

    if (workspaceIds.length > 0) {
      await prisma.workspaceMember.deleteMany({
        where: { workspaceId: { in: workspaceIds } },
      });
      await prisma.subscription.deleteMany({
        where: { workspaceId: { in: workspaceIds } },
      });
      await prisma.user.updateMany({
        where: { activeWorkspaceId: { in: workspaceIds } },
        data: { activeWorkspaceId: null },
      });
      await prisma.workspace.deleteMany({
        where: { id: { in: workspaceIds } },
      });
    }

    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
  };

  const signUpAndLogin = async (email: string, fullName: string) => {
    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      email,
      password: 'Password123!',
      fullName,
      role: 'RECRUITER',
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123!' })
      .expect(200);

    return extractCookie(login.headers['set-cookie']);
  };

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

    await cleanFixtures();

    const cookies: string[] = [];
    for (const user of users) {
      cookies.push(await signUpAndLogin(user.email, user.fullName));
    }
    [ownerCookie, adminCookie, recruiterCookie, viewerCookie, outsiderCookie] =
      cookies;

    const workspaceResponse = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', [ownerCookie])
      .send({ name: 'Subscription Test Workspace' })
      .expect(201);
    workspaceId = workspaceResponse.body.data.id as string;

    const memberships = await prisma.user.findMany({
      where: {
        email: {
          in: [users[1].email, users[2].email, users[3].email],
        },
      },
      select: { id: true, email: true },
    });
    const userIdByEmail = new Map(
      memberships.map((user) => [user.email, user.id]),
    );

    await prisma.workspaceMember.createMany({
      data: [
        {
          workspaceId,
          userId: userIdByEmail.get(users[1].email) ?? '',
          role: WorkspaceMemberRole.ADMIN,
          status: WorkspaceMemberStatus.ACTIVE,
        },
        {
          workspaceId,
          userId: userIdByEmail.get(users[2].email) ?? '',
          role: WorkspaceMemberRole.RECRUITER,
          status: WorkspaceMemberStatus.ACTIVE,
        },
        {
          workspaceId,
          userId: userIdByEmail.get(users[3].email) ?? '',
          role: WorkspaceMemberRole.VIEWER,
          status: WorkspaceMemberStatus.ACTIVE,
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanFixtures();
    await app.close();
  });

  it('lists the fixed authenticated catalogue without requiring workspace context', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/plans')
      .set('Cookie', [ownerCookie])
      .expect(200);

    expect(response.body).toMatchObject({ status: 200, message: 'Success' });
    expect(response.body.data).toEqual([
      expect.objectContaining({
        code: PlanCode.FREE,
        displayOrder: 1,
        enablesBusiness: false,
      }),
      expect.objectContaining({
        code: PlanCode.PLUS,
        displayOrder: 2,
        enablesBusiness: false,
      }),
      expect.objectContaining({
        code: PlanCode.BUSINESS,
        displayOrder: 3,
        enablesBusiness: true,
      }),
    ]);
  });

  it('returns the selected Free subscription only to a member of the resolved workspace', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/subscriptions/current')
      .set('Cookie', [recruiterCookie])
      .set('x-workspace-id', workspaceId)
      .expect(200);

    expect(response.body.data).toMatchObject({
      workspaceId,
      status: 'ACTIVE',
      isBusiness: false,
      plan: { code: PlanCode.FREE, enablesBusiness: false },
    });

    await request(app.getHttpServer())
      .get('/api/v1/subscriptions/current')
      .set('Cookie', [outsiderCookie])
      .set('x-workspace-id', workspaceId)
      .expect(403);
  });

  it('lets an owner select Business and synchronizes the entitlement', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/subscriptions/current')
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .send({ planCode: PlanCode.BUSINESS })
      .expect(200);

    expect(response.body.data).toMatchObject({
      workspaceId,
      isBusiness: true,
      plan: { code: PlanCode.BUSINESS, enablesBusiness: true },
    });
    await expect(
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { isBusiness: true },
      }),
    ).resolves.toEqual({ isBusiness: true });
  });

  it('lets an administrator downgrade to Plus and synchronizes the entitlement', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/subscriptions/current')
      .set('Cookie', [adminCookie])
      .set('x-workspace-id', workspaceId)
      .send({ planCode: PlanCode.PLUS })
      .expect(200);

    expect(response.body.data).toMatchObject({
      isBusiness: false,
      plan: { code: PlanCode.PLUS, enablesBusiness: false },
    });
  });

  it('preserves the plan for recruiter, viewer, invalid-body, unavailable-plan, and repeated requests', async () => {
    const getCurrentCode = async () => {
      const subscription = await prisma.subscription.findUnique({
        where: { workspaceId },
        include: { plan: true },
      });
      return subscription?.plan.code;
    };

    await request(app.getHttpServer())
      .put('/api/v1/subscriptions/current')
      .set('Cookie', [recruiterCookie])
      .set('x-workspace-id', workspaceId)
      .send({ planCode: PlanCode.BUSINESS })
      .expect(403);
    await request(app.getHttpServer())
      .put('/api/v1/subscriptions/current')
      .set('Cookie', [viewerCookie])
      .set('x-workspace-id', workspaceId)
      .send({ planCode: PlanCode.BUSINESS })
      .expect(403);
    await request(app.getHttpServer())
      .put('/api/v1/subscriptions/current')
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .send({ planCode: 'UNKNOWN', isBusiness: true })
      .expect(400);
    expect(await getCurrentCode()).toBe(PlanCode.PLUS);

    await prisma.plan.update({
      where: { code: PlanCode.BUSINESS },
      data: { isActive: false },
    });
    await request(app.getHttpServer())
      .put('/api/v1/subscriptions/current')
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .send({ planCode: PlanCode.BUSINESS })
      .expect(404);
    expect(await getCurrentCode()).toBe(PlanCode.PLUS);
    await prisma.plan.update({
      where: { code: PlanCode.BUSINESS },
      data: { isActive: true },
    });

    const first = await request(app.getHttpServer())
      .put('/api/v1/subscriptions/current')
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .send({ planCode: PlanCode.BUSINESS })
      .expect(200);
    const second = await request(app.getHttpServer())
      .put('/api/v1/subscriptions/current')
      .set('Cookie', [ownerCookie])
      .set('x-workspace-id', workspaceId)
      .send({ planCode: PlanCode.BUSINESS })
      .expect(200);

    expect(first.body.data.id).toBe(second.body.data.id);
    await expect(
      prisma.subscription.count({ where: { workspaceId } }),
    ).resolves.toBe(1);
  });
});
