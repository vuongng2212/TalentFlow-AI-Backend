import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
};

describe('UsersService - New Methods', () => {
  let service: UsersService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('should return paginated users without passwords', async () => {
      const mockUsers = [
        { id: '1', email: 'a@test.com', fullName: 'A', role: 'RECRUITER' },
      ];
      prisma.user.findMany.mockResolvedValue(mockUsers);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockUsers);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter by role', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, role: 'ADMIN' as any });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'ADMIN' }),
        }),
      );
    });
  });

  describe('findOneProfile', () => {
    it('should return user profile', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'a@test.com',
        fullName: 'User A',
        role: 'RECRUITER',
      });

      const result = await service.findOneProfile('1');
      expect(result.email).toBe('a@test.com');
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOneProfile('not-exist')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should allow user to update own profile', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1' });
      prisma.user.update.mockResolvedValue({
        id: '1',
        fullName: 'Updated Name',
      });

      const result = await service.updateProfile('1', '1', 'RECRUITER', {
        fullName: 'Updated Name',
      });
      expect(result.fullName).toBe('Updated Name');
    });

    it('should allow admin to update any profile', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '2' });
      prisma.user.update.mockResolvedValue({
        id: '2',
        fullName: 'Admin Updated',
      });

      const result = await service.updateProfile('2', '1', 'ADMIN', {
        fullName: 'Admin Updated',
      });
      expect(result.fullName).toBe('Admin Updated');
    });

    it('should throw ForbiddenException for non-self non-admin', async () => {
      await expect(
        service.updateProfile('2', '1', 'RECRUITER', { fullName: 'Hack' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateRole', () => {
    it('should update user role', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', role: 'RECRUITER' });
      prisma.user.update.mockResolvedValue({ id: '1', role: 'ADMIN' });

      const result = await service.updateRole('1', 'ADMIN' as any);
      expect(result.role).toBe('ADMIN');
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRole('not-exist', 'ADMIN' as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDeleteUser', () => {
    it('should soft delete user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1' });
      prisma.user.update.mockResolvedValue({
        id: '1',
        deletedAt: expect.any(Date),
      });

      await service.softDeleteUser('1');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.softDeleteUser('not-exist')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
