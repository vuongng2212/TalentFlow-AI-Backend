/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PrismaClient,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceRolesGuard } from './workspace-roles.guard';
import { WORKSPACE_ROLES_KEY } from '../decorators/workspace-roles.decorator';

describe('WorkspaceRolesGuard', () => {
  let guard: WorkspaceRolesGuard;
  let reflector: jest.Mocked<Reflector>;
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    const reflectorMock = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceRolesGuard,
        { provide: Reflector, useValue: reflectorMock },
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
      ],
    }).compile();

    guard = module.get<WorkspaceRolesGuard>(WorkspaceRolesGuard);
    reflector = module.get(Reflector);
    prisma = module.get(PrismaService);
  });

  const createMockContext = (request: any = {}): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
    }) as unknown as ExecutionContext;

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true if no required roles are set', async () => {
      reflector.getAllAndOverride.mockReturnValueOnce(undefined);

      const context = createMockContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true if required roles array is empty', async () => {
      reflector.getAllAndOverride.mockReturnValueOnce([]);

      const context = createMockContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException if user is not authenticated', async () => {
      reflector.getAllAndOverride.mockReturnValueOnce([
        WorkspaceMemberRole.ADMIN,
      ]);

      const request = { workspaceId: 'ws-1' }; // No user
      const context = createMockContext(request);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if workspace context is not resolved', async () => {
      reflector.getAllAndOverride.mockReturnValueOnce([
        WorkspaceMemberRole.ADMIN,
      ]);

      const request = { user: { userId: 'user-1' } }; // No workspaceId
      const context = createMockContext(request);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if user is not an active member', async () => {
      reflector.getAllAndOverride.mockReturnValueOnce([
        WorkspaceMemberRole.ADMIN,
      ]);

      const request = { user: { userId: 'user-1' }, workspaceId: 'ws-1' };
      const context = createMockContext(request);

      prisma.workspaceMember.findFirst.mockResolvedValueOnce(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if user does not have required role', async () => {
      reflector.getAllAndOverride.mockReturnValueOnce([
        WorkspaceMemberRole.ADMIN,
      ]);

      const request = { user: { userId: 'user-1' }, workspaceId: 'ws-1' };
      const context = createMockContext(request);

      prisma.workspaceMember.findFirst.mockResolvedValueOnce({
        id: 'mem-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: WorkspaceMemberRole.VIEWER,
        status: WorkspaceMemberStatus.ACTIVE,
        invitedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return true if user has required role', async () => {
      reflector.getAllAndOverride.mockReturnValueOnce([
        WorkspaceMemberRole.ADMIN,
        WorkspaceMemberRole.OWNER,
      ]);

      const request = { user: { userId: 'user-1' }, workspaceId: 'ws-1' };
      const context = createMockContext(request);

      prisma.workspaceMember.findFirst.mockResolvedValueOnce({
        id: 'mem-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: WorkspaceMemberRole.ADMIN,
        status: WorkspaceMemberStatus.ACTIVE,
        invitedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: 'ws-1',
          userId: 'user-1',
          status: WorkspaceMemberStatus.ACTIVE,
        },
        select: { role: true },
      });
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        WORKSPACE_ROLES_KEY,
        [context.getHandler(), context.getClass()],
      );
    });
  });
});
