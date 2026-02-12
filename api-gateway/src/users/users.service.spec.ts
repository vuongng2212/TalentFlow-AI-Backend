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
      const expectedUser = { id: 'uuid', email };

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
});
