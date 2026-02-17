/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
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

  describe('create', () => {
    it('should create a new user', async () => {
      const createUserDto = {
        email: 'test@example.com',
        password: 'hashedPassword',
        fullName: 'Test User',
        role: Role.RECRUITER,
      };

      const expectedUser = {
        id: 'uuid',
        ...createUserDto,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const createSpy = jest
        .spyOn(prisma.user, 'create')
        .mockResolvedValue(expectedUser);

      const result = await service.create(
        createUserDto.email,
        createUserDto.password,
        createUserDto.fullName,
        createUserDto.role,
      );

      expect(result).toEqual(expectedUser);
      expect(createSpy).toHaveBeenCalledWith({
        data: createUserDto,
      });
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      const email = 'test@example.com';
      const expectedUser = {
        id: 'uuid',
        email,
        password: 'hashed',
        role: Role.RECRUITER,
        fullName: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const findSpy = jest
        .spyOn(prisma.user, 'findUnique')
        .mockResolvedValue(expectedUser);

      const result = await service.findByEmail(email);

      expect(result).toEqual(expectedUser);
      expect(findSpy).toHaveBeenCalledWith({
        where: { email },
      });
    });

    it('should return null if user not found', async () => {
      const email = 'notfound@example.com';
      const findSpy = jest
        .spyOn(prisma.user, 'findUnique')
        .mockResolvedValue(null);

      const result = await service.findByEmail(email);

      expect(result).toBeNull();
      expect(findSpy).toHaveBeenCalledWith({
        where: { email },
      });
    });
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      const id = 'user-uuid';
      const expectedUser = {
        id,
        email: 'test@example.com',
        fullName: 'Test User',
        role: Role.RECRUITER,
        password: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const findSpy = jest
        .spyOn(prisma.user, 'findUnique')
        .mockResolvedValue(expectedUser);

      const result = await service.findById(id);

      expect(result).toEqual(expectedUser);
      expect(findSpy).toHaveBeenCalledWith({
        where: { id },
      });
    });

    it('should return null if user not found by id', async () => {
      const id = 'non-existent-uuid';
      const findSpy = jest
        .spyOn(prisma.user, 'findUnique')
        .mockResolvedValue(null);

      const result = await service.findById(id);

      expect(result).toBeNull();
      expect(findSpy).toHaveBeenCalledWith({
        where: { id },
      });
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const id = 'user-uuid';
      const updateData = { fullName: 'Updated Name' };
      const expectedUser = {
        id,
        email: 'test@example.com',
        fullName: 'Updated Name',
        role: Role.RECRUITER,
        password: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const updateSpy = jest
        .spyOn(prisma.user, 'update')
        .mockResolvedValue(expectedUser);

      const result = await service.update(id, updateData);

      expect(result).toEqual(expectedUser);
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id },
        data: updateData,
      });
    });

    it('should update user role', async () => {
      const id = 'user-uuid';
      const updateData = { role: Role.ADMIN };
      const expectedUser = {
        id,
        email: 'test@example.com',
        fullName: 'Test User',
        role: Role.ADMIN,
        password: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const updateSpy = jest
        .spyOn(prisma.user, 'update')
        .mockResolvedValue(expectedUser);

      const result = await service.update(id, updateData);

      expect(result.role).toBe(Role.ADMIN);
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id },
        data: updateData,
      });
    });
  });

  describe('softDelete', () => {
    it('should soft delete a user', async () => {
      const id = 'user-uuid';
      const deletedAt = new Date();
      const expectedUser = {
        id,
        email: 'test@example.com',
        fullName: 'Test User',
        role: Role.RECRUITER,
        password: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt,
      };

      const updateSpy = jest
        .spyOn(prisma.user, 'update')
        .mockResolvedValue(expectedUser);

      const result = await service.softDelete(id);

      expect(result.deletedAt).not.toBeNull();
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
