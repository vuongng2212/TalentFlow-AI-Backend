/* eslint-disable @typescript-eslint/unbound-method */
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { RedisService } from '../../redis/redis.service';
import { Request } from 'express';
import { REFRESH_TOKEN_COOKIE_NAME } from '../constants/auth.constants';

describe('JwtRefreshStrategy', () => {
  let strategy: JwtRefreshStrategy;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-refresh-secret'),
  };

  const mockRedisService = {
    get: jest.fn(),
    exists: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtRefreshStrategy(
      mockConfigService as unknown as ConfigService,
      mockRedisService as unknown as RedisService,
    );
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should throw error if JWT_REFRESH_SECRET is not defined', () => {
    const emptyConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    expect(() => {
      new JwtRefreshStrategy(
        emptyConfigService as unknown as ConfigService,
        mockRedisService as unknown as RedisService,
      );
    }).toThrow('JWT_REFRESH_SECRET is not defined');
  });

  describe('validate', () => {
    const payload = {
      sub: 'user-1',
      email: 'test@test.com',
      tokenId: 'token-123',
    };

    const mockToken = 'valid-refresh-token';

    const createMockRequest = (token?: string): Request => {
      return {
        cookies: token ? { [REFRESH_TOKEN_COOKIE_NAME]: token } : {},
      } as unknown as Request;
    };

    it('should return user data when token is valid', async () => {
      const request = createMockRequest(mockToken);
      mockRedisService.get.mockResolvedValue(mockToken);
      mockRedisService.exists.mockResolvedValue(false);

      const result = await strategy.validate(request, payload);

      expect(result).toEqual({
        id: payload.sub,
        email: payload.email,
        tokenId: payload.tokenId,
      });
      expect(mockRedisService.get).toHaveBeenCalledWith(
        `refresh_token:${payload.sub}`,
      );
      expect(mockRedisService.exists).toHaveBeenCalledWith(
        `blacklist:${payload.tokenId}`,
      );
    });

    it('should throw UnauthorizedException when token not found in cookies', async () => {
      const request = createMockRequest(undefined);

      await expect(strategy.validate(request, payload)).rejects.toThrow(
        new UnauthorizedException('Refresh token not found'),
      );
    });

    it('should throw UnauthorizedException when stored token does not match', async () => {
      const request = createMockRequest(mockToken);
      mockRedisService.get.mockResolvedValue('different-token');

      await expect(strategy.validate(request, payload)).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });

    it('should throw UnauthorizedException when token is blacklisted', async () => {
      const request = createMockRequest(mockToken);
      mockRedisService.get.mockResolvedValue(mockToken);
      mockRedisService.exists.mockResolvedValue(true);

      await expect(strategy.validate(request, payload)).rejects.toThrow(
        new UnauthorizedException('Token has been revoked'),
      );
    });

    it('should throw UnauthorizedException when stored token is null', async () => {
      const request = createMockRequest(mockToken);
      mockRedisService.get.mockResolvedValue(null);

      await expect(strategy.validate(request, payload)).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });
  });
});
