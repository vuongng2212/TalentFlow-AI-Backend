import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role, WorkspaceMemberStatus } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
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
    prisma = module.get<PrismaService>(PrismaService);
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
      mockPrismaService.$transaction.mockImplementation(
        (fn: (tx: any) => Promise<any>) =>
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

  describe('Basic CRUD', () => {
    it('findByEmail should call prisma.user.findUnique', async () => {
      const email = 'test@test.com';
      mockPrismaService.user.findUnique.mockResolvedValue({ id: '1', email });
      await service.findByEmail(email);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email } });
    });

    it('findById should call prisma.user.findUnique', async () => {
      const id = 'user-1';
      mockPrismaService.user.findUnique.mockResolvedValue({
        id,
        email: 't@t.com',
      });
      await service.findById(id);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id } });
    });

    it('create should call prisma.user.create', async () => {
      const data = {
        email: 't@t.com',
        password: 'p',
        fullName: 'N',
        role: Role.RECRUITER,
      };
      mockPrismaService.user.create.mockResolvedValue({ id: '1', ...data });
      await service.create(data.email, data.password, data.fullName, data.role);
      expect(prisma.user.create).toHaveBeenCalledWith({ data });
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const query = { page: 1, limit: 10 };
      const mockUsers = [{ id: '1', email: 'a@a.com' }];
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(1);

      const result = await service.findAll(query);

      expect(result.data).toEqual(mockUsers);
      expect(result.meta.total).toBe(1);
      expect(prisma.user.findMany).toHaveBeenCalled();
    });
  });

  describe('Profile Update', () => {
    it('should update user profile', async () => {
      const userId = '1';
      const updateDto = { fullName: 'New Name' };
      const updatedUser = {
        id: userId,
        email: 't@t.com',
        fullName: 'New Name',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(updatedUser);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile(
        userId,
        userId,
        Role.RECRUITER,
        updateDto,
      );
      expect(result.fullName).toBe('New Name');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: updateDto,
        }),
      );
    });
  });
});
