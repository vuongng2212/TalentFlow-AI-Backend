import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceMemberRole, WorkspaceMemberStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { WorkspacesService } from './workspaces.service';

type TransactionCallback<TTransaction, TResult = unknown> = (
  tx: TTransaction,
) => Promise<TResult> | TResult;

type CreateWorkspaceTransaction = {
  workspace: {
    create: jest.Mock;
  };
  workspaceMember: {
    create: jest.Mock;
  };
};

type WorkspaceMemberTransaction = {
  workspaceMember: {
    findUnique: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

describe('WorkspacesService', () => {
  let service: WorkspacesService;

  const mockPrismaService = {
    $transaction: jest.fn(),
    workspace: {
      findUnique: jest.fn(),
    },
    workspaceMember: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workspaceInvitation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  let workspaceMaxActiveMembers = 50;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: number) => {
      if (key === 'WORKSPACE_MAX_ACTIVE_MEMBERS') {
        return workspaceMaxActiveMembers;
      }

      return defaultValue;
    }),
  };

  const mockQueueService = {
    publishWorkspaceMemberInvited: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  afterEach(() => {
    workspaceMaxActiveMembers = 50;
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create workspace and owner membership in transaction', async () => {
      const workspace = {
        id: 'workspace-1',
        name: 'Test Workspace',
        isBusiness: true,
      };

      mockPrismaService.$transaction.mockImplementation(
        async (callback: TransactionCallback<CreateWorkspaceTransaction>) => {
          const tx = {
            workspace: {
              create: jest.fn().mockResolvedValue(workspace),
            },
            workspaceMember: {
              create: jest.fn().mockResolvedValue({ id: 'member-1' }),
            },
            user: {
              update: jest.fn().mockResolvedValue({}),
            },
          };

          const result = await callback(tx);

          expect(tx.workspace.create).toHaveBeenCalledWith({
            data: {
              name: 'Test Workspace',
              isBusiness: true,
              createdById: 'user-1',
            },
          });
          expect(tx.workspaceMember.create).toHaveBeenCalledWith({
            data: {
              workspaceId: 'workspace-1',
              userId: 'user-1',
              role: WorkspaceMemberRole.OWNER,
              status: WorkspaceMemberStatus.ACTIVE,
              invitedById: 'user-1',
            },
          });

          return result;
        },
      );

      const result = await service.create('user-1', {
        name: 'Test Workspace',
        isBusiness: true,
      });

      expect(result).toEqual(workspace);
    });
  });

  describe('addMember', () => {
    it('should throw NotFoundException when workspace not found', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('workspace-1', 'owner-1', {
          email: 'member@test.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when workspace is not business', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        isBusiness: false,
      });

      await expect(
        service.addMember('workspace-1', 'owner-1', {
          email: 'member@test.com',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when requester is not owner/admin', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        isBusiness: true,
      });
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.RECRUITER,
      });

      await expect(
        service.addMember('workspace-1', 'requester-1', {
          email: 'member@test.com',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when invited user does not exist', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        isBusiness: true,
      });
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      });
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('workspace-1', 'owner-1', {
          email: 'missing@test.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when invited user is soft-deleted', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        isBusiness: true,
      });
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.ADMIN,
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-2',
        deletedAt: new Date(),
      });

      await expect(
        service.addMember('workspace-1', 'admin-1', {
          email: 'deleted@test.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when user is already an active member', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        isBusiness: true,
      });
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      });
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-2' });

      mockPrismaService.$transaction.mockImplementation(
        (callback: TransactionCallback<WorkspaceMemberTransaction>) => {
          const tx: WorkspaceMemberTransaction = {
            workspaceMember: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'wm-1',
                status: WorkspaceMemberStatus.ACTIVE,
              }),
              count: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          };

          return callback(tx);
        },
      );

      await expect(
        service.addMember('workspace-1', 'owner-1', {
          email: 'member@test.com',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when configured member cap reached', async () => {
      workspaceMaxActiveMembers = 10;

      mockPrismaService.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        isBusiness: true,
      });
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      });
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-2' });

      mockPrismaService.$transaction.mockImplementation(
        (callback: TransactionCallback<WorkspaceMemberTransaction>) => {
          const tx: WorkspaceMemberTransaction = {
            workspaceMember: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'wm-1',
                status: WorkspaceMemberStatus.INVITED,
              }),
              count: jest.fn().mockResolvedValue(10),
              create: jest.fn(),
              update: jest.fn(),
            },
          };

          return callback(tx);
        },
      );

      await expect(
        service.addMember('workspace-1', 'owner-1', {
          email: 'member@test.com',
        }),
      ).rejects.toThrow('Workspace member cap (10) reached');
    });

    it('should reactivate existing non-active member', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        isBusiness: true,
      });
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.ADMIN,
      });
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-2' });

      const updatedMember = {
        id: 'wm-1',
        status: WorkspaceMemberStatus.ACTIVE,
        role: WorkspaceMemberRole.RECRUITER,
        user: {
          id: 'user-2',
          email: 'member@test.com',
          fullName: 'Member User',
        },
      };

      const update = jest.fn().mockResolvedValue(updatedMember);
      mockPrismaService.$transaction.mockImplementation(
        (callback: TransactionCallback<WorkspaceMemberTransaction>) => {
          const tx: WorkspaceMemberTransaction = {
            workspaceMember: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'wm-1',
                status: WorkspaceMemberStatus.REMOVED,
              }),
              count: jest.fn().mockResolvedValue(10),
              create: jest.fn(),
              update,
            },
          };

          return callback(tx);
        },
      );

      const result = await service.addMember('workspace-1', 'admin-1', {
        email: 'member@test.com',
      });

      expect(update).toHaveBeenCalled();
      expect(result).toEqual(updatedMember);
    });

    it('should add member successfully when constraints pass', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        isBusiness: true,
      });
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      });
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-2' });

      const createdMember = {
        id: 'wm-1',
        workspaceId: 'workspace-1',
        userId: 'user-2',
        role: WorkspaceMemberRole.RECRUITER,
      };

      mockPrismaService.$transaction.mockImplementation(
        (callback: TransactionCallback<WorkspaceMemberTransaction>) => {
          const tx: WorkspaceMemberTransaction = {
            workspaceMember: {
              findUnique: jest.fn().mockResolvedValue(null),
              count: jest.fn().mockResolvedValue(2),
              create: jest.fn().mockResolvedValue(createdMember),
              update: jest.fn(),
            },
          };

          return callback(tx);
        },
      );

      const result = await service.addMember('workspace-1', 'owner-1', {
        email: 'member@test.com',
      });

      expect(result).toEqual(createdMember);
    });
  });

  describe('listMembers', () => {
    it('should throw NotFoundException when workspace not found', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue(null);

      await expect(
        service.listMembers('workspace-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when requester is not active member', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
      });
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(
        service.listMembers('workspace-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return active members ordered by createdAt asc', async () => {
      const members = [{ id: 'wm-1' }, { id: 'wm-2' }];

      mockPrismaService.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
      });
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue({
        id: 'wm-owner',
      });
      mockPrismaService.workspaceMember.findMany.mockResolvedValue(members);

      const result = await service.listMembers('workspace-1', 'owner-1');

      expect(mockPrismaService.workspaceMember.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: 'workspace-1',
          status: WorkspaceMemberStatus.ACTIVE,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
      expect(result).toEqual(members);
    });
  });

  describe('ensureActiveMembership', () => {
    it('should return true when active membership exists', async () => {
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue({
        id: 'wm-1',
      });

      await expect(
        service.ensureActiveMembership('workspace-1', 'user-1'),
      ).resolves.toBe(true);
    });

    it('should return false when no membership exists', async () => {
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(
        service.ensureActiveMembership('workspace-1', 'user-1'),
      ).resolves.toBe(false);
    });
  });

  describe('createInvitation', () => {
    it('should throw NotFoundException when workspace not found', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue(null);

      await expect(
        service.createInvitation('workspace-1', 'owner-1', {
          email: 'invitee@test.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when workspace is not business', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        name: 'Personal',
        isBusiness: false,
      });

      await expect(
        service.createInvitation('workspace-1', 'owner-1', {
          email: 'invitee@test.com',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when requester is not owner/admin', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        name: 'Biz',
        isBusiness: true,
      });
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.RECRUITER,
      });

      await expect(
        service.createInvitation('workspace-1', 'recruiter-1', {
          email: 'invitee@test.com',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create invitation, upsert INVITED membership, and publish event when user exists', async () => {
      const workspace = {
        id: 'workspace-1',
        name: 'Biz',
        isBusiness: true,
      };
      mockPrismaService.workspace.findUnique.mockResolvedValue(workspace);
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      });
      const existingUser = { id: 'user-invitee' };
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.workspaceMember.upsert.mockResolvedValue({});
      const createdInvitation = {
        id: 'inv-1',
        email: 'invitee@test.com',
        workspaceId: 'workspace-1',
        token: 'tok',
      };
      mockPrismaService.workspaceInvitation.create.mockResolvedValue(
        createdInvitation,
      );

      const result = await service.createInvitation('workspace-1', 'owner-1', {
        email: 'invitee@test.com',
        role: WorkspaceMemberRole.RECRUITER,
      });

      expect(result).toEqual(createdInvitation);
      expect(mockPrismaService.workspaceInvitation.create).toHaveBeenCalled();
      expect(
        mockQueueService.publishWorkspaceMemberInvited,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'invitee@test.com',
          workspaceName: 'Biz',
          inviteUrl: expect.stringContaining('token='),
        }),
      );
    });
  });

  describe('acceptInvitation', () => {
    it('should throw BadRequestException when token missing', async () => {
      await expect(service.acceptInvitation('user-1', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when token invalid', async () => {
      mockPrismaService.$transaction.mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            workspaceInvitation: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
          };
          return callback(tx);
        },
      );

      await expect(
        service.acceptInvitation('user-1', 'invalid-token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when token expired', async () => {
      mockPrismaService.$transaction.mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            workspaceInvitation: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'inv-1',
                email: 'a@b.com',
                workspaceId: 'ws-1',
                role: WorkspaceMemberRole.RECRUITER,
                invitedById: 'owner-1',
                expiresAt: new Date(Date.now() - 1000),
                workspace: { id: 'ws-1', name: 'X' },
              }),
            },
          };
          return callback(tx);
        },
      );

      await expect(
        service.acceptInvitation('user-1', 'expired-token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept invitation, transition to ACTIVE, and update activeWorkspaceId', async () => {
      const future = new Date(Date.now() + 1000 * 60 * 60);
      mockPrismaService.$transaction.mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            workspaceInvitation: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'inv-1',
                email: 'a@b.com',
                workspaceId: 'ws-1',
                role: WorkspaceMemberRole.RECRUITER,
                invitedById: 'owner-1',
                expiresAt: future,
                workspace: { id: 'ws-1', name: 'X' },
              }),
              delete: jest.fn().mockResolvedValue({}),
            },
            user: {
              findUnique: jest
                .fn()
                .mockResolvedValue({ id: 'user-1', email: 'a@b.com' }),
              update: jest.fn().mockResolvedValue({}),
            },
            workspaceMember: {
              upsert: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(tx);
        },
      );

      const result = await service.acceptInvitation('user-1', 'valid-token');

      expect(result).toEqual({
        workspaceId: 'ws-1',
        workspaceName: 'X',
        role: WorkspaceMemberRole.RECRUITER,
      });
    });
  });
});
