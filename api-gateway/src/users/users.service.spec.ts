import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role, WorkspaceMemberStatus } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    workspace: {
      create: jest.Mock;
    };
    workspaceMember: {
      create: jest.Mock;
      findFirst: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const mockPrismaService = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workspace: {
      create: jest.fn(),
    },
    workspaceMember: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWithPersonalWorkspace', () => {
    it('should provision user, personal workspace, OWNER membership, and activeWorkspaceId atomically', async () => {
      const newUser = {
        id: 'user-1',
        email: 'test@example.com',
        fullName: 'Test User',
        password: 'hashed',
        role: Role.RECRUITER,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        activeWorkspaceId: null,
      };
      const personalWorkspace = {
        id: 'ws-1',
        name: 'Test User - Personal Workspace',
        isBusiness: false,
      };
      const updatedUser = {
        ...newUser,
        activeWorkspaceId: 'ws-1',
      };

      // Simulate transaction body
      mockPrismaService.$transaction.mockImplementation((fn) =>
        fn({
          user: {
            create: jest.fn().mockResolvedValue(newUser),
            update: jest.fn().mockResolvedValue(updatedUser),
          },
          workspace: {
            create: jest.fn().mockResolvedValue(personalWorkspace),
          },
          workspaceMember: {
            create: jest.fn().mockResolvedValue({}),
          },
        }),
      );

      const result = await service.createWithPersonalWorkspace(
        'test@example.com',
        'hashed',
        'Test User',
        Role.RECRUITER,
      );

      expect(result.user).toEqual(updatedUser);
      expect(result.personalWorkspaceId).toBe('ws-1');
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('switchActiveWorkspace', () => {
    it('should update the active workspace when user is an active member', async () => {
      const userId = 'user-1';
      const workspaceId = 'ws-2';
      const updatedUser = {
        id: userId,
        email: 'a@b.com',
        fullName: 'A',
        role: Role.RECRUITER,
        activeWorkspaceId: workspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrismaService.workspaceMember.findFirst.mockResolvedValue({
        id: 'm-1',
      });
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.switchActiveWorkspace(userId, workspaceId);

      expect(result).toEqual(updatedUser);
      expect(mockPrismaService.workspaceMember.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId,
          userId,
          status: WorkspaceMemberStatus.ACTIVE,
        },
        select: { id: true },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { activeWorkspaceId: workspaceId },
        select: expect.objectContaining({ activeWorkspaceId: true }),
      });
    });

    it('should throw ForbiddenException when user is not an active member', async () => {
      mockPrismaService.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(
        service.switchActiveWorkspace('user-1', 'ws-99'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  // Suppress unused-variable warning for prisma — it is used via module.get above.
  void prisma;
});
