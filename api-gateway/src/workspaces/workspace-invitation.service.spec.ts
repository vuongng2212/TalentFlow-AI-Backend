/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceMemberRole, WorkspaceMemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { WorkspaceInvitationService } from './workspace-invitation.service';
import { WorkspaceConfigService } from './workspace-config.service';
import { WorkspaceMemberService } from './workspace-member.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

describe('WorkspaceInvitationService', () => {
  let service: WorkspaceInvitationService;
  let prisma: DeepMockProxy<PrismaClient>;
  let queueService: jest.Mocked<QueueService>;

  const mockConfigService = {
    invitationExpiryDays: 7,
    inviteBaseUrl: 'http://localhost:3001/invite/accept',
  };

  const mockQueueService = {
    publishWorkspaceMemberInvited: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const mockMemberService = {
      ensureCanManageMembers: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceInvitationService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaClient>(),
        },
        {
          provide: WorkspaceConfigService,
          useValue: mockConfigService,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: WorkspaceMemberService,
          useValue: mockMemberService,
        },
      ],
    }).compile();

    service = module.get<WorkspaceInvitationService>(
      WorkspaceInvitationService,
    );
    prisma = module.get(PrismaService);
    queueService = module.get(QueueService);
  });

  describe('ensureBusinessPlanActive', () => {
    it('should throw ForbiddenException if workspace is not business', () => {
      expect(() =>
        service.ensureBusinessPlanActive({ isBusiness: false }),
      ).toThrow(
        new ForbiddenException('Workspace is not on an active Business plan'),
      );
    });

    it('should not throw if workspace is business', () => {
      expect(() =>
        service.ensureBusinessPlanActive({ isBusiness: true }),
      ).not.toThrow();
    });
  });

  describe('createInvitation', () => {
    it('should throw NotFoundException when workspace is not found', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(
        service.createInvitation('ws-1', 'owner-1', {
          email: 'invitee@test.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when workspace is not business', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        isBusiness: false,
      } as never);

      await expect(
        service.createInvitation('ws-1', 'owner-1', {
          email: 'invitee@test.com',
        }),
      ).rejects.toThrow(
        new ForbiddenException('Workspace is not on an active Business plan'),
      );
    });

    it('should create invitation and publish queue event', async () => {
      const workspace = { id: 'ws-1', name: 'Biz WS', isBusiness: true };
      prisma.workspace.findUnique.mockResolvedValue(workspace as never);

      const createdInvitation = {
        id: 'inv-1',
        email: 'invitee@test.com',
        workspaceId: 'ws-1',
        token: 'mock-token',
        role: WorkspaceMemberRole.RECRUITER,
        expiresAt: new Date(),
      };
      (prisma.workspaceInvitation.create as jest.Mock).mockResolvedValue(
        createdInvitation,
      );
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await service.createInvitation('ws-1', 'owner-1', {
        email: 'invitee@test.com',
      });

      expect(res).toEqual(createdInvitation);
      expect(queueService.publishWorkspaceMemberInvited).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'invitee@test.com',
          workspaceName: 'Biz WS',
        }),
      );
    });

    it('should upsert member as INVITED if user already exists', async () => {
      const workspace = { id: 'ws-1', name: 'Biz WS', isBusiness: true };
      prisma.workspace.findUnique.mockResolvedValue(workspace as never);
      prisma.workspaceInvitation.create.mockResolvedValue({
        id: 'inv-1',
        email: 'invitee@test.com',
      } as never);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-existing',
      } as never);

      await service.createInvitation('ws-1', 'owner-1', {
        email: 'invitee@test.com',
      });

      expect(prisma.workspaceMember.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId_userId: {
              workspaceId: 'ws-1',
              userId: 'user-existing',
            },
          },
          create: expect.objectContaining({
            status: WorkspaceMemberStatus.INVITED,
          }),
        }),
      );
    });
  });

  describe('acceptInvitation', () => {
    it('should throw BadRequestException if token is missing', async () => {
      await expect(service.acceptInvitation('user-1', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if invitation is not found', async () => {
      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          workspaceInvitation: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return cb(tx);
      });

      await expect(
        service.acceptInvitation('user-1', 'invalid-token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if invitation expired', async () => {
      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          workspaceInvitation: {
            findUnique: jest.fn().mockResolvedValue({
              token: 'tok-1',
              expiresAt: new Date(Date.now() - 10000),
            }),
          },
        };
        return cb(tx);
      });

      await expect(service.acceptInvitation('user-1', 'tok-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if acceptor user is not found', async () => {
      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          workspaceInvitation: {
            findUnique: jest.fn().mockResolvedValue({
              token: 'tok-1',
              expiresAt: new Date(Date.now() + 10000),
            }),
          },
          user: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        return cb(tx);
      });

      await expect(service.acceptInvitation('user-1', 'tok-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if acceptor email does not match invitation email', async () => {
      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          workspaceInvitation: {
            findUnique: jest.fn().mockResolvedValue({
              token: 'tok-1',
              email: 'a@test.com',
              expiresAt: new Date(Date.now() + 10000),
            }),
          },
          user: {
            findUnique: jest
              .fn()
              .mockResolvedValue({ id: 'user-1', email: 'b@test.com' }),
          },
        };
        return cb(tx);
      });

      await expect(service.acceptInvitation('user-1', 'tok-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should accept invitation successfully', async () => {
      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          workspaceInvitation: {
            findUnique: jest.fn().mockResolvedValue({
              token: 'tok-1',
              email: 'a@test.com',
              workspaceId: 'ws-1',
              role: WorkspaceMemberRole.RECRUITER,
              invitedById: 'owner-1',
              expiresAt: new Date(Date.now() + 10000),
              workspace: { name: 'Biz WS' },
            }),
            delete: jest.fn().mockResolvedValue({}),
          },
          user: {
            findUnique: jest
              .fn()
              .mockResolvedValue({ id: 'user-1', email: 'a@test.com' }),
            update: jest.fn().mockResolvedValue({}),
          },
          workspaceMember: {
            upsert: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      const res = await service.acceptInvitation('user-1', 'tok-1');
      expect(res).toEqual({
        workspaceId: 'ws-1',
        workspaceName: 'Biz WS',
        role: WorkspaceMemberRole.RECRUITER,
      });
    });
  });
});
