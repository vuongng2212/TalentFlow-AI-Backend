/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { PrismaClient, WorkspaceMemberStatus } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import {
  WorkspaceContextGuard,
  WORKSPACE_CONTEXT_KEY,
} from './workspace-context.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_WORKSPACE_CONTEXT_KEY } from '../decorators/skip-workspace-context.decorator';

describe('WorkspaceContextGuard', () => {
  let guard: WorkspaceContextGuard;
  let reflector: jest.Mocked<Reflector>;
  let prisma: DeepMockProxy<PrismaClient>;
  let cls: jest.Mocked<ClsService>;

  beforeEach(async () => {
    const reflectorMock = {
      getAllAndOverride: jest.fn(),
    };

    const clsMock = {
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceContextGuard,
        { provide: Reflector, useValue: reflectorMock },
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
        { provide: ClsService, useValue: clsMock },
      ],
    }).compile();

    guard = module.get<WorkspaceContextGuard>(WorkspaceContextGuard);
    reflector = module.get(Reflector);
    prisma = module.get(PrismaService);
    cls = module.get(ClsService);
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
    it('should return true if route is public', async () => {
      reflector.getAllAndOverride.mockReturnValueOnce(true); // IS_PUBLIC_KEY

      const context = createMockContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('should throw ForbiddenException if no user in request', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      const context = createMockContext({ headers: {} });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should set workspaceId from header if user is active member', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      const request = {
        user: { userId: 'user-1' },
        headers: { 'x-workspace-id': 'ws-1' },
        workspaceId: undefined,
      };
      const context = createMockContext(request);

      prisma.workspaceMember.findFirst.mockResolvedValueOnce({
        id: 'mem-1',
      } as any);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: 'ws-1',
          userId: 'user-1',
          status: WorkspaceMemberStatus.ACTIVE,
        },
        select: { id: true },
      });
      expect(request.workspaceId).toBe('ws-1');
      expect(cls.set).toHaveBeenCalledWith(WORKSPACE_CONTEXT_KEY, 'ws-1');
    });

    it('should handle x-workspace-id as an array', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      const request = {
        user: { userId: 'user-1' },
        headers: { 'x-workspace-id': ['ws-1', 'ws-2'] },
      };
      const context = createMockContext(request);

      prisma.workspaceMember.findFirst.mockResolvedValueOnce({
        id: 'mem-1',
      } as any);

      await guard.canActivate(context);

      expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ workspaceId: 'ws-1' }),
        }),
      );
    });

    it('should throw ForbiddenException if user is not active member of requested workspace in header', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      const request = {
        user: { userId: 'user-1' },
        headers: { 'x-workspace-id': 'ws-1' },
      };
      const context = createMockContext(request);

      prisma.workspaceMember.findFirst.mockResolvedValueOnce(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return true but swallow error if skipWorkspaceContext is true', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === SKIP_WORKSPACE_CONTEXT_KEY) return true;
        return false;
      });

      const request = {
        user: { userId: 'user-1' },
        headers: { 'x-workspace-id': 'ws-1' },
      };
      const context = createMockContext(request);

      prisma.workspaceMember.findFirst.mockResolvedValueOnce(null); // Will throw ForbiddenException

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should fallback to activeWorkspaceId if no header provided', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      const request = {
        user: { userId: 'user-1' },
        headers: {},
        workspaceId: undefined,
      };
      const context = createMockContext(request);

      prisma.user.findUnique.mockResolvedValueOnce({
        activeWorkspaceId: 'ws-active',
      } as any);
      prisma.workspaceMember.findFirst.mockResolvedValueOnce({
        id: 'mem-1',
      } as any);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { activeWorkspaceId: true },
      });
      expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: 'ws-active',
          userId: 'user-1',
          status: WorkspaceMemberStatus.ACTIVE,
        },
        select: { id: true },
      });
      expect(request.workspaceId).toBe('ws-active');
      expect(cls.set).toHaveBeenCalledWith(WORKSPACE_CONTEXT_KEY, 'ws-active');
    });

    it('should fallback to first active membership if activeWorkspaceId is invalid', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      const request = {
        user: { userId: 'user-1' },
        headers: {},
        workspaceId: undefined,
      };
      const context = createMockContext(request);

      prisma.user.findUnique.mockResolvedValueOnce({
        activeWorkspaceId: 'ws-invalid',
      } as any);
      // First call for activeWorkspaceId check fails
      prisma.workspaceMember.findFirst.mockResolvedValueOnce(null);
      // Second call for first active membership succeeds
      prisma.workspaceMember.findFirst.mockResolvedValueOnce({
        workspaceId: 'ws-first',
      } as any);
      prisma.user.update.mockResolvedValueOnce({} as any);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prisma.workspaceMember.findFirst).toHaveBeenCalledTimes(2);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { activeWorkspaceId: 'ws-first' },
      });
      expect(request.workspaceId).toBe('ws-first');
    });

    it('should fallback to first active membership if no activeWorkspaceId exists', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      const request = {
        user: { userId: 'user-1' },
        headers: {},
        workspaceId: undefined,
      };
      const context = createMockContext(request);

      prisma.user.findUnique.mockResolvedValueOnce({
        activeWorkspaceId: null,
      } as any);
      prisma.workspaceMember.findFirst.mockResolvedValueOnce({
        workspaceId: 'ws-first',
      } as any);
      prisma.user.update.mockResolvedValueOnce({} as any);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.workspaceId).toBe('ws-first');
    });

    it('should throw BadRequestException if no header, no activeWorkspaceId, and no active memberships', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      const request = {
        user: { userId: 'user-1' },
        headers: {},
      };
      const context = createMockContext(request);

      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.workspaceMember.findFirst.mockResolvedValueOnce(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
