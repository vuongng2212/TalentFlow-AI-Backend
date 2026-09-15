/* eslint-disable @typescript-eslint/no-explicit-any */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkspaceMemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceCoreService } from './workspace-core.service';
import { WorkspaceMemberService } from './workspace-member.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

describe('WorkspaceCoreService', () => {
  let service: WorkspaceCoreService;
  let prisma: DeepMockProxy<PrismaClient>;
  let memberService: jest.Mocked<WorkspaceMemberService>;

  beforeEach(async () => {
    const mockMemberService = {
      ensureMemberAccess: jest.fn().mockResolvedValue(undefined),
      ensureCanManageMembers: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceCoreService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaClient>(),
        },
        {
          provide: WorkspaceMemberService,
          useValue: mockMemberService,
        },
      ],
    }).compile();

    service = module.get<WorkspaceCoreService>(WorkspaceCoreService);
    prisma = module.get(PrismaService);
    memberService = module.get(WorkspaceMemberService);
  });

  describe('create', () => {
    it('should create workspace and owner member within transaction', async () => {
      const workspace = {
        id: 'ws-1',
        name: 'New WS',
        isBusiness: false,
        createdById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          workspace: { create: jest.fn().mockResolvedValue(workspace) },
          workspaceMember: { create: jest.fn().mockResolvedValue({}) },
          user: { update: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      const res = await service.create('user-1', { name: 'New WS' });
      expect(res).toEqual(workspace);
    });
  });

  describe('findAllForUser', () => {
    it('should return workspaces enriched with memberRole', async () => {
      const mockMemberships = [
        {
          role: WorkspaceMemberRole.OWNER,
          workspace: {
            id: 'ws-1',
            name: 'WS 1',
            isBusiness: true,
            createdById: 'user-1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];
      (prisma.workspaceMember.findMany as jest.Mock).mockResolvedValue(
        mockMemberships,
      );

      const res = await service.findAllForUser('user-1');
      expect(res).toHaveLength(1);
      expect(res[0]).toEqual({
        ...mockMemberships[0].workspace,
        memberRole: WorkspaceMemberRole.OWNER,
      });
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when workspace does not exist', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(service.findOne('ws-99', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if member access check fails', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        name: 'WS 1',
        isBusiness: false,
        createdById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [],
      } as never);

      memberService.ensureMemberAccess.mockRejectedValue(
        new ForbiddenException('You are not a member of this workspace'),
      );

      await expect(service.findOne('ws-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return workspace details when member exists', async () => {
      const now = new Date();
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        name: 'WS 1',
        isBusiness: true,
        createdById: 'user-1',
        createdAt: now,
        updatedAt: now,
        members: [{ userId: 'user-1', role: WorkspaceMemberRole.OWNER }],
      } as never);

      const res = await service.findOne('ws-1', 'user-1');
      expect(res).toEqual({
        id: 'ws-1',
        name: 'WS 1',
        isBusiness: true,
        createdById: 'user-1',
        createdAt: now,
        updatedAt: now,
        memberRole: WorkspaceMemberRole.OWNER,
        memberCount: 1,
      });
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when workspace is missing', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(
        service.update('ws-99', 'user-1', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when manage check fails', async () => {
      prisma.workspace.findUnique.mockResolvedValue({ id: 'ws-1' } as never);
      memberService.ensureCanManageMembers.mockRejectedValue(
        new ForbiddenException('Only workspace owner/admin can manage members'),
      );

      await expect(
        service.update('ws-1', 'user-2', { name: 'Updated' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update workspace name when authorized', async () => {
      const ws = { id: 'ws-1', name: 'Old' };
      const updatedWs = { id: 'ws-1', name: 'Updated' };
      prisma.workspace.findUnique.mockResolvedValue(ws as never);
      (prisma.workspace.update as jest.Mock).mockResolvedValue(updatedWs);

      const res = await service.update('ws-1', 'user-1', { name: 'Updated' });
      expect(res).toEqual(updatedWs);
    });
  });
});
