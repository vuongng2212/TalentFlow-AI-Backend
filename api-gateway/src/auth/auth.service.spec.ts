import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as passwordUtil from '../common/utils/password.util';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let redisService: RedisService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    signAsync: jest.fn(),
  };

  const mockRedisService = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_ACCESS_SECRET') return 'access-secret';
      if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret';
      if (key === 'JWT_ACCESS_EXPIRATION') return '15m';
      if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('should successfully signup a user', async () => {
      const signupData = {
        email: 'test@example.com',
        password: 'Password123!',
        fullName: 'Test User',
        role: Role.RECRUITER,
      };

      (mockUsersService.findByEmail as jest.Mock).mockResolvedValue(null);
      jest.spyOn(passwordUtil, 'hashPassword').mockResolvedValue('hashed_password');
      (mockUsersService.create as jest.Mock).mockResolvedValue({ id: 'uuid', ...signupData });

      const result = await service.signup(signupData.email, signupData.password, signupData.fullName, signupData.role);

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(signupData.email);
      expect(passwordUtil.hashPassword).toHaveBeenCalledWith(signupData.password);
      expect(mockUsersService.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw ConflictException if email exists', async () => {
      (mockUsersService.findByEmail as jest.Mock).mockResolvedValue({ id: 'uuid' });

      await expect(
        service.signup('test@example.com', 'Password123!', 'Test', Role.RECRUITER),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return tokens and user on successful login', async () => {
      const loginData = { email: 'test@example.com', password: 'Password123!' };
      const user = { id: 'uuid', email: loginData.email, password: 'hashed_password', role: Role.RECRUITER };

      (mockUsersService.findByEmail as jest.Mock).mockResolvedValue(user);
      jest.spyOn(passwordUtil, 'comparePassword').mockResolvedValue(true);
      (mockJwtService.signAsync as jest.Mock).mockResolvedValue('token');

      const result = await service.login(loginData.email, loginData.password);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(mockRedisService.set).toHaveBeenCalled(); // Should store refresh token
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      (mockUsersService.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login('wrong@email.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
