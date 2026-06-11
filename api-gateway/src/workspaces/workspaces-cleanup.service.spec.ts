import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesCleanupService } from './workspaces-cleanup.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WorkspacesCleanupService', () => {
  let service: WorkspacesCleanupService;
  let prisma: {
    workspaceInvitation: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    user: {
      findMany: jest.Mock;
    };
    workspaceMember: {
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const mockPrismaService = {
    workspaceInvitation: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    workspaceMember: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesCleanupService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<WorkspacesCleanupService>(WorkspacesCleanupService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cleanExpiredInvitations', () => {
    it('should do nothing if there are no expired invitations', async () => {
      prisma.workspaceInvitation.findMany.mockResolvedValue([]);

      await service.cleanExpiredInvitations();

      expect(prisma.workspaceInvitation.findMany).toHaveBeenCalled();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.workspaceInvitation.deleteMany).not.toHaveBeenCalled();
    });

    it('should process expired invitations, update members, and delete records', async () => {
      const expiredInvitations = [
        { workspaceId: 'ws-1', email: 'user1@test.com' },
        { workspaceId: 'ws-2', email: 'user2@test.com' },
        { workspaceId: 'ws-1', email: 'unknown@test.com' },
      ];

      const matchedUsers = [
        { id: 'u-1', email: 'user1@test.com' },
        { id: 'u-2', email: 'user2@test.com' },
      ];

      prisma.workspaceInvitation.findMany.mockResolvedValue(expiredInvitations);
      prisma.user.findMany.mockResolvedValue(matchedUsers);
      prisma.$transaction.mockResolvedValue(true);
      prisma.workspaceInvitation.deleteMany.mockResolvedValue({ count: 3 });

      await service.cleanExpiredInvitations();

      // Ensure findMany gets called with correct criteria
      expect(prisma.workspaceInvitation.findMany).toHaveBeenCalledWith({
        where: { expiresAt: { lte: expect.any(Date) } },
        select: { workspaceId: true, email: true },
      });

      // Ensure user lookups are correct
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          email: {
            in: ['user1@test.com', 'user2@test.com', 'unknown@test.com'],
          },
        },
        select: { id: true, email: true },
      });

      // Ensure transaction executes the updates
      expect(prisma.$transaction).toHaveBeenCalled();

      // Ensure deleteMany is called
      expect(prisma.workspaceInvitation.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lte: expect.any(Date) } },
      });
    });

    it('should log errors and not crash the application', async () => {
      prisma.workspaceInvitation.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      // If an error is thrown, the cron job should catch it and log it safely
      await expect(service.cleanExpiredInvitations()).resolves.not.toThrow();
    });
  });
});
