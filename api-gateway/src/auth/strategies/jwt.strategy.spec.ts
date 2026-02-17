/* eslint-disable @typescript-eslint/unbound-method */
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';
import { Role } from '@prisma/client';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: UsersService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret'),
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: Role.RECRUITER,
    fullName: 'Test User',
    deletedAt: null,
  };

  const mockUsersService = {
    findById: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(
      mockConfigService as unknown as ConfigService,
      mockUsersService as unknown as UsersService,
    );
    usersService = mockUsersService as unknown as UsersService;
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should throw error if JWT_ACCESS_SECRET is not defined', () => {
    const emptyConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    expect(() => {
      new JwtStrategy(
        emptyConfigService as unknown as ConfigService,
        mockUsersService as unknown as UsersService,
      );
    }).toThrow('JWT_ACCESS_SECRET is not defined');
  });

  describe('validate', () => {
    const payload = {
      sub: 'user-1',
      email: 'test@test.com',
      role: 'RECRUITER',
    };

    it('should return user data when user exists', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        fullName: mockUser.fullName,
      });
      expect(usersService.findById).toHaveBeenCalledWith(payload.sub);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is deleted', async () => {
      mockUsersService.findById.mockResolvedValue({
        ...mockUser,
        deletedAt: new Date(),
      });

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
