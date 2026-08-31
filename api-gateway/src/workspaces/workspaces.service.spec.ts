/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
  PrismaClient,
  User,
  WorkspaceMember,
  Workspace,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { WorkspaceConfigService } from './workspace-config.service';
import { WorkspaceCoreService } from './workspace-core.service';
import { WorkspaceMemberService } from './workspace-member.service';
import { WorkspaceInvitationService } from './workspace-invitation.service';
import { WorkspacesService } from './workspaces.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let prisma: DeepMockProxy<PrismaClient>;

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
        WorkspaceConfigService,
        WorkspaceCoreService,
        WorkspaceMemberService,
        WorkspaceInvitationService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaClient>(),
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
    prisma = module.get(PrismaService);
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

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          workspace: {
            create: jest.fn().mockResolvedValue(workspace),
          },
          workspaceMember: {
            create: jest.fn().mockResolvedValue({ id: 'member-1' }),
          },
          user: {
            update: jest.fn().mockResolvedValue(workspace),
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
      });

      const result = await service.create('user-1', {
        name: 'Test Workspace',
        isBusiness: true,
      });

      expect(result).toEqual(workspace);
    });
  });

  describe('addMember', () => {
    it('should throw NotFoundException when workspace not found', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('workspace-1', 'owner-1', {
          email: 'member@test.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when workspace is not business', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        isBusiness: false,
      } as never);

      await expect(
        service.addMember('workspace-1', 'owner-1', {
          email: 'member@test.com',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when requester is not owner/admin', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        isBusiness: true,
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.RECRUITER,
      } as never);

      await expect(
        service.addMember('workspace-1', 'requester-1', {
          email: 'member@test.com',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when invited user does not exist', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        isBusiness: true,
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      } as never);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('workspace-1', 'owner-1', {
          email: 'missing@test.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when invited user is soft-deleted', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        isBusiness: true,
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.ADMIN,
      } as never);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        deletedAt: new Date(),
      } as never);

      await expect(
        service.addMember('workspace-1', 'admin-1', {
          email: 'deleted@test.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when user is already an active member', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        isBusiness: true,
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      } as never);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
      } as unknown as User);

      prisma.$transaction.mockImplementation((callback: any) => {
        const tx = {
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
      });

      await expect(
        service.addMember('workspace-1', 'owner-1', {
          email: 'member@test.com',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when configured member cap reached', async () => {
      workspaceMaxActiveMembers = 10;

      prisma.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        isBusiness: true,
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      } as never);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
      } as unknown as User);

      prisma.$transaction.mockImplementation((callback: any) => {
        const tx = {
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
      });

      await expect(
        service.addMember('workspace-1', 'owner-1', {
          email: 'member@test.com',
        }),
      ).rejects.toThrow('Workspace member cap (10) reached');
    });

    it('should reactivate existing non-active member', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        isBusiness: true,
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.ADMIN,
      } as never);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
      } as unknown as User);

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
      prisma.$transaction.mockImplementation((callback: any) => {
        const tx = {
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
      });

      const result = await service.addMember('workspace-1', 'admin-1', {
        email: 'member@test.com',
      });

      expect(update).toHaveBeenCalled();
      expect(result).toEqual(updatedMember);
    });

    it('should add member successfully when constraints pass', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        isBusiness: true,
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      } as never);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
      } as unknown as User);

      const createdMember = {
        id: 'wm-1',
        workspaceId: 'workspace-1',
        userId: 'user-2',
        role: WorkspaceMemberRole.RECRUITER,
      };

      prisma.$transaction.mockImplementation((callback: any) => {
        const tx = {
          workspaceMember: {
            findUnique: jest.fn().mockResolvedValue(null),
            count: jest.fn().mockResolvedValue(2),
            create: jest.fn().mockResolvedValue(createdMember),
            update: jest.fn(),
          },
        };

        return callback(tx);
      });

      const result = await service.addMember('workspace-1', 'owner-1', {
        email: 'member@test.com',
      });

      expect(result).toEqual(createdMember);
    });
  });

  describe('listMembers', () => {
    it('should throw NotFoundException when workspace not found', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(
        service.listMembers('workspace-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when requester is not active member', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(
        service.listMembers('workspace-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return active members ordered by createdAt asc', async () => {
      const members = [{ id: 'wm-1' }, { id: 'wm-2' }];

      prisma.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'wm-owner',
      } as never);
      prisma.workspaceMember.findMany.mockResolvedValue(
        members as unknown as WorkspaceMember[],
      );

      const result = await service.listMembers('workspace-1', 'owner-1');

      expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith({
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
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'wm-1',
      } as never);

      await expect(
        service.ensureActiveMembership('workspace-1', 'user-1'),
      ).resolves.toBe(true);
    });

    it('should return false when no membership exists', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(
        service.ensureActiveMembership('workspace-1', 'user-1'),
      ).resolves.toBe(false);
    });
  });

  describe('createInvitation', () => {
    it('should throw NotFoundException when workspace not found', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(
        service.createInvitation('workspace-1', 'owner-1', {
          email: 'invitee@test.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when workspace is not business', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        name: 'Personal',
        isBusiness: false,
      } as never);

      await expect(
        service.createInvitation('workspace-1', 'owner-1', {
          email: 'invitee@test.com',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when requester is not owner/admin', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        name: 'Biz',
        isBusiness: true,
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.RECRUITER,
      } as never);

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
      prisma.workspace.findUnique.mockResolvedValue(
        workspace as unknown as Workspace,
      );
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      } as never);
      const existingUser = { id: 'user-invitee' };
      prisma.user.findUnique.mockResolvedValue(existingUser as unknown as User);
      prisma.workspaceMember.upsert.mockResolvedValue(
        {} as unknown as WorkspaceMember,
      );
      const createdInvitation = {
        id: 'inv-1',
        email: 'invitee@test.com',
        workspaceId: 'workspace-1',
        token: 'tok',
      };
      prisma.workspaceInvitation.create.mockResolvedValue(
        createdInvitation as any,
      );

      const result = await service.createInvitation('workspace-1', 'owner-1', {
        email: 'invitee@test.com',
        role: WorkspaceMemberRole.RECRUITER,
      });

      expect(result).toEqual(createdInvitation);
      expect(prisma.workspaceInvitation.create).toHaveBeenCalled();
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
      prisma.$transaction.mockImplementation((callback: any) => {
        const tx = {
          workspaceInvitation: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(tx);
      });

      await expect(
        service.acceptInvitation('user-1', 'invalid-token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when token expired', async () => {
      prisma.$transaction.mockImplementation((callback: any) => {
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
      });

      await expect(
        service.acceptInvitation('user-1', 'expired-token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept invitation, transition to ACTIVE, and update activeWorkspaceId', async () => {
      const future = new Date(Date.now() + 1000 * 60 * 60);
      prisma.$transaction.mockImplementation((callback: any) => {
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
      });

      const result = await service.acceptInvitation('user-1', 'valid-token');

      expect(result).toEqual({
        workspaceId: 'ws-1',
        workspaceName: 'X',
        role: WorkspaceMemberRole.RECRUITER,
      });
    });
  });

  describe('removeMember', () => {
    it('should throw ForbiddenException if requester is not OWNER or ADMIN', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValueOnce({
        role: WorkspaceMemberRole.VIEWER,
      } as never);

      await expect(
        service.removeMember('ws-1', 'requester-1', 'target-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if target member is not found or not active', async () => {
      prisma.workspaceMember.findFirst
        .mockResolvedValueOnce({ role: WorkspaceMemberRole.ADMIN } as any)
        .mockResolvedValueOnce(null);

      await expect(
        service.removeMember('ws-1', 'requester-1', 'target-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if trying to remove the owner', async () => {
      prisma.workspaceMember.findFirst
        .mockResolvedValueOnce({ role: WorkspaceMemberRole.ADMIN } as any)
        .mockResolvedValueOnce({ role: WorkspaceMemberRole.OWNER } as never);

      await expect(
        service.removeMember('ws-1', 'requester-1', 'target-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully remove member and reset activeWorkspaceId if it matches', async () => {
      prisma.workspaceMember.findFirst
        .mockResolvedValueOnce({ role: WorkspaceMemberRole.ADMIN } as any)
        .mockResolvedValueOnce({
          role: WorkspaceMemberRole.RECRUITER,
        } as never);

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          workspaceMember: {
            update: jest.fn().mockResolvedValue({}),
            findFirst: jest.fn().mockResolvedValue(null),
          },
          user: {
            findUnique: jest
              .fn()
              .mockResolvedValue({ activeWorkspaceId: 'ws-1' }),
            update: jest.fn().mockResolvedValue({}),
          },
        };
        const result = await callback(tx);
        expect(tx.workspaceMember.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              workspaceId_userId: {
                workspaceId: 'ws-1',
                userId: 'target-1',
              },
            },
            data: {
              status: WorkspaceMemberStatus.REMOVED,
            },
          }),
        );
        expect(tx.user.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'target-1' },
            data: { activeWorkspaceId: null },
          }),
        );
        return result;
      });

      await service.removeMember('ws-1', 'requester-1', 'target-1');
    });
  });

  describe('findAllForUser', () => {
    it('should return an empty array when user has no active memberships', async () => {
      prisma.workspaceMember.findMany.mockResolvedValue([]);

      const result = await service.findAllForUser('user-1');

      expect(result).toEqual([]);
      expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            status: WorkspaceMemberStatus.ACTIVE,
          },
        }),
      );
    });

    it('should return workspaces enriched with memberRole from each membership', async () => {
      const memberships = [
        {
          role: WorkspaceMemberRole.OWNER,
          workspace: {
            id: 'ws-1',
            name: 'Personal',
            isBusiness: false,
            createdById: 'user-1',
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
          },
        },
        {
          role: WorkspaceMemberRole.RECRUITER,
          workspace: {
            id: 'ws-2',
            name: 'Acme Corp',
            isBusiness: true,
            createdById: 'user-99',
            createdAt: new Date('2026-02-01'),
            updatedAt: new Date('2026-02-01'),
          },
        },
      ];
      prisma.workspaceMember.findMany.mockResolvedValue(
        memberships as unknown as WorkspaceMember[],
      );

      const result = await service.findAllForUser('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ...memberships[0].workspace,
        memberRole: WorkspaceMemberRole.OWNER,
      });
      expect(result[1]).toEqual({
        ...memberships[1].workspace,
        memberRole: WorkspaceMemberRole.RECRUITER,
      });
    });

    it('should query with orderBy createdAt asc', async () => {
      prisma.workspaceMember.findMany.mockResolvedValue([]);

      await service.findAllForUser('user-42');

      expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when workspace does not exist', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(service.findOne('ws-missing', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when requester is not an active member', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        name: 'Test',
        isBusiness: false,
        createdById: 'user-99',
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [],
      } as never);
      // ensureMemberAccess uses workspaceMember.findFirst — return null = not a member
      prisma.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(service.findOne('ws-1', 'stranger-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return workspace detail with memberRole and memberCount for an active member', async () => {
      const members = [
        { userId: 'user-1', role: WorkspaceMemberRole.OWNER },
        { userId: 'user-2', role: WorkspaceMemberRole.RECRUITER },
      ];
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        name: 'My Workspace',
        isBusiness: true,
        createdById: 'user-1',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        members,
      } as never);
      // ensureMemberAccess succeeds
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'wm-1',
      } as never);

      const result = await service.findOne('ws-1', 'user-1');

      expect(result).toEqual({
        id: 'ws-1',
        name: 'My Workspace',
        isBusiness: true,
        createdById: 'user-1',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        memberRole: WorkspaceMemberRole.OWNER,
        memberCount: 2,
      });
    });

    it('should return memberRole as null when caller is not in the member list (edge case)', async () => {
      // Possible if ensureMemberAccess uses a different query path than the embedded members list
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        name: 'Edge',
        isBusiness: false,
        createdById: 'owner-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [{ userId: 'owner-1', role: WorkspaceMemberRole.OWNER }],
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'wm-x',
      } as never);

      const result = await service.findOne('ws-1', 'user-not-in-list');

      expect(result.memberRole).toBeNull();
      expect(result.memberCount).toBe(1);
    });

    it('should select only the expected fields from the workspace', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        name: 'Select Test',
        isBusiness: false,
        createdById: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [{ userId: 'u1', role: WorkspaceMemberRole.OWNER }],
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'wm-1',
      } as never);

      await service.findOne('ws-1', 'u1');

      expect(prisma.workspace.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ws-1' },
          select: expect.objectContaining({
            id: true,
            name: true,
            isBusiness: true,
            createdById: true,
            createdAt: true,
            updatedAt: true,
            members: expect.objectContaining({
              where: { status: WorkspaceMemberStatus.ACTIVE },
            }),
          }),
        }),
      );
    });
  });

  describe('update', () => {
    const workspaceFixture = {
      id: 'ws-1',
      name: 'Original Name',
      isBusiness: false,
      createdById: 'owner-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should throw NotFoundException when workspace does not exist', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(
        service.update('ws-missing', 'user-1', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when requester has RECRUITER role', async () => {
      prisma.workspace.findUnique.mockResolvedValue(workspaceFixture);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.RECRUITER,
      } as never);

      await expect(
        service.update('ws-1', 'recruiter-1', { name: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when requester has VIEWER role', async () => {
      prisma.workspace.findUnique.mockResolvedValue(workspaceFixture);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.VIEWER,
      } as never);

      await expect(
        service.update('ws-1', 'viewer-1', { name: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when requester is not a member', async () => {
      prisma.workspace.findUnique.mockResolvedValue(workspaceFixture);
      prisma.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(
        service.update('ws-1', 'outsider-1', { name: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update workspace name when called by OWNER', async () => {
      const updated = { ...workspaceFixture, name: 'New Name' };

      prisma.workspace.findUnique.mockResolvedValue(workspaceFixture);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      } as never);
      (prisma.workspace.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.update('ws-1', 'owner-1', {
        name: 'New Name',
      });

      expect(prisma.workspace.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ws-1' },
          data: { name: 'New Name' },
        }),
      );
      expect(result).toEqual(updated);
    });

    it('should update workspace name when called by ADMIN', async () => {
      const updated = { ...workspaceFixture, name: 'Admin Rename' };

      prisma.workspace.findUnique.mockResolvedValue(workspaceFixture);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.ADMIN,
      } as never);
      (prisma.workspace.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.update('ws-1', 'admin-1', {
        name: 'Admin Rename',
      });

      expect(result.name).toBe('Admin Rename');
    });

    it('should upgrade workspace to business plan when isBusiness is set to true', async () => {
      const upgraded = { ...workspaceFixture, isBusiness: true };

      prisma.workspace.findUnique.mockResolvedValue(workspaceFixture);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      } as never);
      (prisma.workspace.update as jest.Mock).mockResolvedValue(upgraded);

      const result = await service.update('ws-1', 'owner-1', {
        isBusiness: true,
      });

      expect(prisma.workspace.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isBusiness: true },
        }),
      );
      expect(result.isBusiness).toBe(true);
    });

    it('should allow updating name and isBusiness simultaneously', async () => {
      const updated = {
        ...workspaceFixture,
        name: 'Acme Biz',
        isBusiness: true,
      };

      prisma.workspace.findUnique.mockResolvedValue(workspaceFixture);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      } as never);
      (prisma.workspace.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.update('ws-1', 'owner-1', {
        name: 'Acme Biz',
        isBusiness: true,
      });

      expect(prisma.workspace.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'Acme Biz', isBusiness: true },
        }),
      );
      expect(result).toEqual(updated);
    });

    it('should not include undefined fields in the update data', async () => {
      // Only isBusiness provided — name must NOT appear in data
      const updated = { ...workspaceFixture, isBusiness: true };

      prisma.workspace.findUnique.mockResolvedValue(workspaceFixture);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      } as never);
      (prisma.workspace.update as jest.Mock).mockResolvedValue(updated);

      await service.update('ws-1', 'owner-1', { isBusiness: true });

      const callArg = (prisma.workspace.update as any).mock.calls[0][0];
      expect(callArg.data).not.toHaveProperty('name');
      expect(callArg.data).toEqual({ isBusiness: true });
    });

    it('should return only the selected fields from workspace.update', async () => {
      const updatedRecord = {
        id: 'ws-1',
        name: 'Selected',
        isBusiness: false,
        createdById: 'owner-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.workspace.findUnique.mockResolvedValue(workspaceFixture);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      } as never);
      (prisma.workspace.update as jest.Mock).mockResolvedValue(updatedRecord);

      await service.update('ws-1', 'owner-1', { name: 'Selected' });

      expect(prisma.workspace.update).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            name: true,
            isBusiness: true,
            createdById: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      );
    });
  });
});
