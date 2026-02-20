import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as passwordUtil from '../common/utils/password.util';
import {
  SecurityAuditService,
  SecurityEventType,
} from '../common/services/security-audit.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
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
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
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

  const mockSecurityAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SecurityAuditService, useValue: mockSecurityAuditService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
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

      mockUsersService.findByEmail.mockResolvedValue(null);
      jest
        .spyOn(passwordUtil, 'hashPassword')
        .mockResolvedValue('hashed_password');
      mockUsersService.create.mockResolvedValue({
        id: 'uuid',
        ...signupData,
        createdAt: new Date(),
      });

      const result = await service.signup(
        signupData.email,
        signupData.password,
        signupData.fullName,
        signupData.role,
      );

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        signupData.email,
      );
      expect(passwordUtil.hashPassword).toHaveBeenCalledWith(
        signupData.password,
      );
      expect(mockUsersService.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(mockSecurityAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.SIGNUP,
          userId: 'uuid',
          email: signupData.email,
        }),
      );
    });

    it('should throw ConflictException if email exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'uuid',
      });

      await expect(
        service.signup(
          'test@example.com',
          'Password123!',
          'Test',
          Role.RECRUITER,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    beforeEach(() => {
      mockRedisService.get.mockResolvedValue(null);
    });

    it('should return tokens and user on successful login', async () => {
      const loginData = { email: 'test@example.com', password: 'Password123!' };
      const user = {
        id: 'uuid',
        email: loginData.email,
        password: 'hashed_password',
        fullName: 'Test User',
        role: Role.RECRUITER,
        createdAt: new Date(),
      };

      mockUsersService.findByEmail.mockResolvedValue(user);
      jest.spyOn(passwordUtil, 'comparePassword').mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('token');

      const result = await service.login(loginData.email, loginData.password);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(mockRedisService.set).toHaveBeenCalled();
      expect(mockRedisService.del).toHaveBeenCalledWith(
        `login_attempts:${loginData.email}`,
      );
      expect(mockSecurityAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.LOGIN_SUCCESS,
          userId: user.id,
          email: user.email,
        }),
      );
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockRedisService.incr.mockResolvedValue(1);

      await expect(
        service.login('wrong@email.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockSecurityAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.LOGIN_FAILED,
        }),
      );
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      const user = {
        id: 'uuid',
        email: 'test@example.com',
        password: 'hashed_password',
        role: Role.RECRUITER,
        deletedAt: null,
      };

      mockUsersService.findByEmail.mockResolvedValue(user);
      jest.spyOn(passwordUtil, 'comparePassword').mockResolvedValue(false);
      mockRedisService.incr.mockResolvedValue(1);

      await expect(
        service.login('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockSecurityAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.LOGIN_FAILED,
          userId: user.id,
        }),
      );
    });

    it('should throw UnauthorizedException if user is deleted', async () => {
      const user = {
        id: 'uuid',
        email: 'test@example.com',
        password: 'hashed_password',
        role: Role.RECRUITER,
        deletedAt: new Date(),
      };

      mockUsersService.findByEmail.mockResolvedValue(user);
      mockRedisService.incr.mockResolvedValue(1);

      await expect(
        service.login('test@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('account lockout', () => {
    it('should block login after max failed attempts', async () => {
      mockRedisService.get.mockResolvedValue('5');
      mockRedisService.ttl.mockResolvedValue(600);

      await expect(
        service.login('locked@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockSecurityAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.LOGIN_BLOCKED,
          email: 'locked@example.com',
        }),
      );
    });

    it('should increment login attempts on failed login', async () => {
      mockRedisService.get.mockResolvedValue('2');
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockRedisService.incr.mockResolvedValue(3);

      await expect(
        service.login('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockRedisService.incr).toHaveBeenCalledWith(
        'login_attempts:test@example.com',
      );
    });

    it('should set expiry on first failed attempt', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockRedisService.incr.mockResolvedValue(1);

      await expect(
        service.login('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockRedisService.expire).toHaveBeenCalledWith(
        'login_attempts:test@example.com',
        15 * 60,
      );
    });

    it('should log ACCOUNT_LOCKED when max attempts reached', async () => {
      mockRedisService.get.mockResolvedValue('4');
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockRedisService.incr.mockResolvedValue(5);

      await expect(
        service.login('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockSecurityAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.ACCOUNT_LOCKED,
        }),
      );
    });

    it('should clear login attempts on successful login', async () => {
      mockRedisService.get.mockResolvedValue('3');
      const user = {
        id: 'uuid',
        email: 'test@example.com',
        password: 'hashed_password',
        fullName: 'Test User',
        role: Role.RECRUITER,
        createdAt: new Date(),
      };

      mockUsersService.findByEmail.mockResolvedValue(user);
      jest.spyOn(passwordUtil, 'comparePassword').mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('token');

      await service.login('test@example.com', 'correctpassword');

      expect(mockRedisService.del).toHaveBeenCalledWith(
        'login_attempts:test@example.com',
      );
    });

    it('should return login attempts count', async () => {
      mockRedisService.get.mockResolvedValue('3');

      const attempts = await service.getLoginAttempts('test@example.com');

      expect(attempts).toBe(3);
    });

    it('should return 0 if no login attempts', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const attempts = await service.getLoginAttempts('test@example.com');

      expect(attempts).toBe(0);
    });

    it('should return remaining lockout time', async () => {
      mockRedisService.ttl.mockResolvedValue(300);

      const remaining =
        await service.getRemainingLockoutTime('test@example.com');

      expect(remaining).toBe(300);
    });

    it('should return 0 if no lockout', async () => {
      mockRedisService.ttl.mockResolvedValue(-2);

      const remaining =
        await service.getRemainingLockoutTime('test@example.com');

      expect(remaining).toBe(0);
    });
  });

  describe('refresh', () => {
    it('should return new tokens on refresh', async () => {
      const user = {
        id: 'uuid',
        email: 'test@example.com',
        role: Role.RECRUITER,
        deletedAt: null,
      };

      mockUsersService.findById.mockResolvedValue(user);
      mockJwtService.signAsync.mockResolvedValue('new-token');

      const result = await service.refresh('uuid');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockRedisService.set).toHaveBeenCalled();
      expect(mockSecurityAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.TOKEN_REFRESH,
          userId: user.id,
        }),
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.refresh('non-existent-uuid')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockSecurityAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.TOKEN_REFRESH_FAILED,
        }),
      );
    });

    it('should throw UnauthorizedException if user is deleted', async () => {
      const user = {
        id: 'uuid',
        email: 'test@example.com',
        role: Role.RECRUITER,
        deletedAt: new Date(),
      };

      mockUsersService.findById.mockResolvedValue(user);

      await expect(service.refresh('uuid')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should delete refresh token and blacklist tokenId', async () => {
      mockRedisService.del.mockResolvedValue(1);
      mockRedisService.set.mockResolvedValue('OK');

      await service.logout('user-uuid', 'token-id-123');

      expect(mockRedisService.del).toHaveBeenCalledWith(
        'refresh_token:user-uuid',
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'blacklist:token-id-123',
        'true',
        7 * 24 * 60 * 60,
      );
      expect(mockSecurityAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.LOGOUT,
          userId: 'user-uuid',
        }),
      );
    });

    it('should log logout with context', async () => {
      mockRedisService.del.mockResolvedValue(1);
      mockRedisService.set.mockResolvedValue('OK');

      await service.logout('user-uuid', 'token-id-123', {
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(mockSecurityAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.LOGOUT,
          userId: 'user-uuid',
          ip: '192.168.1.1',
        }),
      );
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      const user = {
        id: 'uuid',
        email: 'test@example.com',
        password: 'hashed_password',
        role: Role.RECRUITER,
        deletedAt: null,
      };

      mockUsersService.findByEmail.mockResolvedValue(user);
      jest.spyOn(passwordUtil, 'comparePassword').mockResolvedValue(false);

      await expect(
        service.login('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is deleted', async () => {
      const user = {
        id: 'uuid',
        email: 'test@example.com',
        password: 'hashed_password',
        role: Role.RECRUITER,
        deletedAt: new Date(),
      };

      mockUsersService.findByEmail.mockResolvedValue(user);

      await expect(
        service.login('test@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should return new tokens on refresh', async () => {
      const user = {
        id: 'uuid',
        email: 'test@example.com',
        role: Role.RECRUITER,
        deletedAt: null,
      };

      mockUsersService.findById.mockResolvedValue(user);
      mockJwtService.signAsync.mockResolvedValue('new-token');

      const result = await service.refresh('uuid');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockRedisService.set).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.refresh('non-existent-uuid')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user is deleted', async () => {
      const user = {
        id: 'uuid',
        email: 'test@example.com',
        role: Role.RECRUITER,
        deletedAt: new Date(),
      };

      mockUsersService.findById.mockResolvedValue(user);

      await expect(service.refresh('uuid')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should delete refresh token and blacklist tokenId', async () => {
      mockRedisService.del.mockResolvedValue(1);
      mockRedisService.set.mockResolvedValue('OK');

      await service.logout('user-uuid', 'token-id-123');

      expect(mockRedisService.del).toHaveBeenCalledWith(
        'refresh_token:user-uuid',
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'blacklist:token-id-123',
        'true',
        7 * 24 * 60 * 60,
      );
    });
  });
});
