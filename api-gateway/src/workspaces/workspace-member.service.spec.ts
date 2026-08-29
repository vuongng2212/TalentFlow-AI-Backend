/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceMemberRole, WorkspaceMemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceMemberService } from './workspace-member.service';
import { WorkspaceConfigService } from './workspace-config.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

describe('WorkspaceMemberService', () => {
  let service: WorkspaceMemberService;
  let prisma: DeepMockProxy<PrismaClient>;

  const mockConfigService = {
    maxActiveMembers: 50,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceMemberService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaClient>(),
        },
        {
          provide: WorkspaceConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<WorkspaceMemberService>(WorkspaceMemberService);
    prisma = module.get(PrismaService);
  });

  describe('addMember', () => {
    it('should throw NotFoundException when workspace not found', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('ws-1', 'owner-1', { email: 'user@test.com' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when workspace is not on active Business plan', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        isBusiness: false,
      } as never);

      await expect(
        service.addMember('ws-1', 'owner-1', { email: 'user@test.com' }),
      ).rejects.toThrow(
        new ForbiddenException('Workspace is not on an active Business plan'),
      );
    });

    it('should throw ForbiddenException when requester is not owner/admin', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        isBusiness: true,
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.RECRUITER,
      } as never);

      await expect(
        service.addMember('ws-1', 'recruiter-1', { email: 'user@test.com' }),
      ).rejects.toThrow(
        new ForbiddenException('Only workspace owner/admin can manage members'),
      );
    });

    it('should throw NotFoundException when user email does not exist', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        isBusiness: true,
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      } as never);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('ws-1', 'owner-1', { email: 'user@test.com' }),
      ).rejects.toThrow(
        new NotFoundException('User with provided email does not exist'),
      );
    });

    it('should throw ConflictException when user is already an active member', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        isBusiness: true,
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      } as never);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'user2@test.com',
      } as never);

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          workspaceMember: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'm-2',
              status: WorkspaceMemberStatus.ACTIVE,
            }),
          },
        };
        return cb(tx);
      });

      await expect(
        service.addMember('ws-1', 'owner-1', { email: 'user2@test.com' }),
      ).rejects.toThrow(
        new ConflictException('User is already an active member'),
      );
    });

    it('should throw ConflictException when workspace active member cap is reached', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        isBusiness: true,
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      } as never);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'user2@test.com',
      } as never);

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          workspaceMember: {
            findUnique: jest.fn().mockResolvedValue(null),
            count: jest.fn().mockResolvedValue(50),
          },
        };
        return cb(tx);
      });

      await expect(
        service.addMember('ws-1', 'owner-1', { email: 'user2@test.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create new member when user is not existing', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        isBusiness: true,
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      } as never);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'user2@test.com',
      } as never);

      const createdMember = {
        id: 'm-2',
        workspaceId: 'ws-1',
        userId: 'user-2',
        role: WorkspaceMemberRole.RECRUITER,
        status: WorkspaceMemberStatus.ACTIVE,
      };

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          workspaceMember: {
            findUnique: jest.fn().mockResolvedValue(null),
            count: jest.fn().mockResolvedValue(1),
            create: jest.fn().mockResolvedValue(createdMember),
          },
        };
        return cb(tx);
      });

      const res = await service.addMember('ws-1', 'owner-1', {
        email: 'user2@test.com',
      });
      expect(res).toEqual(createdMember);
    });

    it('should revive REMOVED member by updating the existing row', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        isBusiness: true,
      } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.OWNER,
      } as never);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'user2@test.com',
      } as never);

      const updatedMember = {
        id: 'm-2',
        workspaceId: 'ws-1',
        userId: 'user-2',
        role: WorkspaceMemberRole.RECRUITER,
        status: WorkspaceMemberStatus.ACTIVE,
      };

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          workspaceMember: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'm-2',
              status: WorkspaceMemberStatus.REMOVED,
            }),
            count: jest.fn().mockResolvedValue(1),
            update: jest.fn().mockResolvedValue(updatedMember),
          },
        };
        return cb(tx);
      });

      const res = await service.addMember('ws-1', 'owner-1', {
        email: 'user2@test.com',
      });
      expect(res).toEqual(updatedMember);
    });
  });

  describe('listMembers', () => {
    it('should throw NotFoundException when workspace does not exist', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(service.listMembers('ws-99', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return member list when requester has access', async () => {
      prisma.workspace.findUnique.mockResolvedValue({ id: 'ws-1' } as never);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'm-1',
      } as never);
      const members = [
        {
          id: 'm-1',
          userId: 'user-1',
          user: {
            id: 'user-1',
            email: 'u1@test.com',
            fullName: 'U1',
            role: 'USER',
          },
        },
      ];
      (prisma.workspaceMember.findMany as jest.Mock).mockResolvedValue(members);

      const res = await service.listMembers('ws-1', 'user-1');
      expect(res).toEqual(members);
    });
  });

  describe('removeMember', () => {
    it('should throw NotFoundException if target member is not active', async () => {
      prisma.workspaceMember.findFirst
        .mockResolvedValueOnce({ role: WorkspaceMemberRole.OWNER } as never) // requester check
        .mockResolvedValueOnce(null); // target check

      await expect(
        service.removeMember('ws-1', 'owner-1', 'user-2'),
      ).rejects.toThrow(
        new NotFoundException('Member not found or already removed'),
      );
    });

    it('should throw ForbiddenException if trying to remove the workspace owner', async () => {
      prisma.workspaceMember.findFirst
        .mockResolvedValueOnce({ role: WorkspaceMemberRole.ADMIN } as never)
        .mockResolvedValueOnce({ role: WorkspaceMemberRole.OWNER } as never);

      await expect(
        service.removeMember('ws-1', 'admin-1', 'owner-1'),
      ).rejects.toThrow(
        new ForbiddenException('Cannot remove the workspace owner'),
      );
    });

    it('should soft-delete target member by setting status to REMOVED', async () => {
      prisma.workspaceMember.findFirst
        .mockResolvedValueOnce({ role: WorkspaceMemberRole.OWNER } as never)
        .mockResolvedValueOnce({
          role: WorkspaceMemberRole.RECRUITER,
        } as never);

      prisma.$transaction.mockImplementation((cb: any) => {
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
        return cb(tx);
      });

      await service.removeMember('ws-1', 'owner-1', 'user-2');
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('ensureCanManageMembers & ensureMemberAccess & ensureActiveMembership', () => {
    it('ensureCanManageMembers should throw 403 non-member message when user is not member', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue(null);
      await expect(
        service.ensureCanManageMembers('ws-1', 'user-1'),
      ).rejects.toThrow(
        new ForbiddenException('You are not a member of this workspace'),
      );
    });

    it('ensureCanManageMembers should throw 403 non-owner/admin message when user is recruiter', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue({
        role: WorkspaceMemberRole.RECRUITER,
      } as never);
      await expect(
        service.ensureCanManageMembers('ws-1', 'user-1'),
      ).rejects.toThrow(
        new ForbiddenException('Only workspace owner/admin can manage members'),
      );
    });

    it('ensureMemberAccess should throw when not member', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue(null);
      await expect(
        service.ensureMemberAccess('ws-1', 'user-1'),
      ).rejects.toThrow(
        new ForbiddenException('You are not a member of this workspace'),
      );
    });

    it('ensureActiveMembership should return boolean', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'm-1',
      } as never);
      expect(await service.ensureActiveMembership('ws-1', 'user-1')).toBe(true);

      prisma.workspaceMember.findFirst.mockResolvedValue(null);
      expect(await service.ensureActiveMembership('ws-1', 'user-2')).toBe(
        false,
      );
    });
  });
});
