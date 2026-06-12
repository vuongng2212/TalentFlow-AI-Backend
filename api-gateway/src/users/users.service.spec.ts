/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role, WorkspaceMemberStatus, PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaClient>(),
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
      prisma.$transaction.mockImplementation((fn: any) =>
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
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should call prisma.user.create', async () => {
      const newUser = { id: 'user-2' };
      prisma.user.create.mockResolvedValue(newUser as any);

      const result = await service.create(
        'test2@example.com',
        'hashed',
        'Test 2',
        Role.ADMIN,
      );

      expect(result).toEqual(newUser);
      expect(prisma.user.create).toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('should call prisma.user.findUnique by email', async () => {
      const user = { id: 'user-1' };
      prisma.user.findUnique.mockResolvedValue(user as any);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('findById', () => {
    it('should call prisma.user.findUnique by id', async () => {
      const user = { id: 'user-1' };
      prisma.user.findUnique.mockResolvedValue(user as any);

      const result = await service.findById('user-1');

      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
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

      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'm-1',
      } as any);
      prisma.user.update.mockResolvedValue(updatedUser as any);

      const result = await service.switchActiveWorkspace(userId, workspaceId);

      expect(result).toEqual(updatedUser);
      expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId,
          userId,
          status: WorkspaceMemberStatus.ACTIVE,
        },
        select: { id: true },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { activeWorkspaceId: workspaceId },
        select: expect.objectContaining({ activeWorkspaceId: true }),
      });
    });

    it('should throw ForbiddenException when user is not an active member', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(
        service.switchActiveWorkspace('user-1', 'ws-99'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated users with no filters', async () => {
      const users = [{ id: '1' }, { id: '2' }];
      prisma.user.findMany.mockResolvedValue(users as any);
      prisma.user.count.mockResolvedValue(2);

      const result = await service.findAll({});

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toEqual({
        data: users as any,
        meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
      });
    });

    it('should apply search and role filters', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({
        search: 'test',
        role: Role.ADMIN,
        page: 2,
        limit: 5,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: null,
            OR: [
              { fullName: { contains: 'test', mode: 'insensitive' } },
              { email: { contains: 'test', mode: 'insensitive' } },
            ],
            role: Role.ADMIN,
          },
          skip: 5,
          take: 5,
        }),
      );
    });
  });

  describe('findOneProfile', () => {
    it('should return user profile if found', async () => {
      const user = { id: '1' };
      prisma.user.findUnique.mockResolvedValue(user as any);

      const result = await service.findOneProfile('1');

      expect(result).toEqual(user);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOneProfile('1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update user', async () => {
      const updatedUser = { id: '1' };
      prisma.user.update.mockResolvedValue(updatedUser as any);

      const result = await service.update('1', { fullName: 'Updated' });

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { fullName: 'Updated' },
      });
    });
  });

  describe('updateProfile', () => {
    it('should allow user to update own profile', async () => {
      const updatedUser = { id: '1', fullName: 'New Name' };
      prisma.user.findUnique.mockResolvedValue({ id: '1' } as any);
      prisma.user.update.mockResolvedValue(updatedUser as any);

      const result = await service.updateProfile('1', '1', 'RECRUITER', {
        fullName: 'New Name',
      });

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: { fullName: 'New Name' },
        }),
      );
    });

    it('should allow admin to update other profile', async () => {
      const updatedUser = { id: '2', fullName: 'New Name' };
      prisma.user.findUnique.mockResolvedValue({ id: '2' } as any);
      prisma.user.update.mockResolvedValue(updatedUser as any);

      const result = await service.updateProfile('2', '1', 'ADMIN', {
        fullName: 'New Name',
      });

      expect(result).toEqual(updatedUser);
    });

    it('should throw ForbiddenException if non-admin tries to update other profile', async () => {
      await expect(
        service.updateProfile('2', '1', 'RECRUITER', { fullName: 'New Name' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile('1', '1', 'RECRUITER', { fullName: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRole', () => {
    it('should update role if user exists', async () => {
      const updatedUser = { id: '1', role: Role.ADMIN };
      prisma.user.findUnique.mockResolvedValue({ id: '1' } as any);
      prisma.user.update.mockResolvedValue(updatedUser as any);

      const result = await service.updateRole('1', Role.ADMIN);

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: { role: Role.ADMIN },
        }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateRole('1', Role.ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('softDelete', () => {
    it('should update deletedAt', async () => {
      prisma.user.update.mockResolvedValue({ id: '1' } as any);

      await service.softDelete('1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: { deletedAt: expect.any(Date) },
        }),
      );
    });
  });

  describe('softDeleteUser', () => {
    it('should update deletedAt if user exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1' } as any);
      prisma.user.update.mockResolvedValue({ id: '1' } as any);

      await service.softDeleteUser('1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: { deletedAt: expect.any(Date) },
        }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.softDeleteUser('1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
