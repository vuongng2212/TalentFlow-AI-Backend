import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { hashPassword, comparePassword } from '../common/utils/password.util';
import {
  SecurityAuditService,
  SecurityEventType,
} from '../common/services/security-audit.service';
import {
  JWT_ACCESS_TOKEN_EXPIRATION,
  JWT_REFRESH_TOKEN_EXPIRATION,
} from './constants/auth.constants';
import {
  ACCOUNT_LOCKOUT_MAX_ATTEMPTS,
  ACCOUNT_LOCKOUT_DURATION_SECONDS,
  LOGIN_ATTEMPTS_KEY_PREFIX,
} from './constants/security.constants';
import { randomUUID } from 'crypto';

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

interface RefreshTokenPayload extends TokenPayload {
  tokenId: string;
}

interface LoginContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  async signup(email: string, password: string, fullName: string, role: Role) {
    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await hashPassword(password);

    const user = await this.usersService.create(
      email,
      hashedPassword,
      fullName,
      role,
    );

    this.securityAuditService.log({
      eventType: SecurityEventType.SIGNUP,
      userId: user.id,
      email: user.email,
      details: { role: user.role },
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async login(email: string, password: string, context?: LoginContext) {
    await this.checkAccountLockout(email);

    const user = await this.usersService.findByEmail(email);

    if (!user || user.deletedAt) {
      await this.handleFailedLogin(email, context);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      await this.handleFailedLogin(email, context, user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.clearLoginAttempts(email);

    const { accessToken, refreshToken } = await this.generateTokens(user);

    await this.storeRefreshToken(user.id, refreshToken);

    this.securityAuditService.log({
      eventType: SecurityEventType.LOGIN_SUCCESS,
      userId: user.id,
      email: user.email,
      ip: context?.ip,
      userAgent: context?.userAgent,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }

  async refresh(userId: string, context?: LoginContext) {
    const user = await this.usersService.findById(userId);

    if (!user || user.deletedAt) {
      this.securityAuditService.log({
        eventType: SecurityEventType.TOKEN_REFRESH_FAILED,
        userId,
        ip: context?.ip,
        details: { reason: 'User not found or deleted' },
      });
      throw new UnauthorizedException('User not found');
    }

    const { accessToken, refreshToken } = await this.generateTokens(user);

    await this.storeRefreshToken(user.id, refreshToken);

    this.securityAuditService.log({
      eventType: SecurityEventType.TOKEN_REFRESH,
      userId: user.id,
      email: user.email,
      ip: context?.ip,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async logout(userId: string, tokenId: string, context?: LoginContext) {
    await this.redisService.del(`refresh_token:${userId}`);

    const refreshTokenExpiration = 7 * 24 * 60 * 60;
    await this.redisService.set(
      `blacklist:${tokenId}`,
      'true',
      refreshTokenExpiration,
    );

    this.securityAuditService.log({
      eventType: SecurityEventType.LOGOUT,
      userId,
      ip: context?.ip,
      details: { tokenId },
    });
  }

  async getLoginAttempts(email: string): Promise<number> {
    const key = `${LOGIN_ATTEMPTS_KEY_PREFIX}${email}`;
    const attempts = await this.redisService.get(key);
    return attempts ? parseInt(attempts, 10) : 0;
  }

  async getRemainingLockoutTime(email: string): Promise<number> {
    const key = `${LOGIN_ATTEMPTS_KEY_PREFIX}${email}`;
    const ttl = await this.redisService.ttl(key);
    return ttl > 0 ? ttl : 0;
  }

  private async checkAccountLockout(email: string): Promise<void> {
    const attempts = await this.getLoginAttempts(email);

    if (attempts >= ACCOUNT_LOCKOUT_MAX_ATTEMPTS) {
      const remainingTime = await this.getRemainingLockoutTime(email);
      const remainingMinutes = Math.ceil(remainingTime / 60);

      this.securityAuditService.log({
        eventType: SecurityEventType.LOGIN_BLOCKED,
        email,
        details: {
          attempts,
          remainingMinutes,
        },
      });

      throw new UnauthorizedException(
        `Account temporarily locked. Try again in ${remainingMinutes} minute(s).`,
      );
    }
  }

  private async handleFailedLogin(
    email: string,
    context?: LoginContext,
    userId?: string,
  ): Promise<void> {
    const key = `${LOGIN_ATTEMPTS_KEY_PREFIX}${email}`;
    const attempts = await this.redisService.incr(key);

    if (attempts === 1) {
      await this.redisService.expire(key, ACCOUNT_LOCKOUT_DURATION_SECONDS);
    }

    this.securityAuditService.log({
      eventType: SecurityEventType.LOGIN_FAILED,
      userId,
      email,
      ip: context?.ip,
      userAgent: context?.userAgent,
      details: {
        attempts,
        maxAttempts: ACCOUNT_LOCKOUT_MAX_ATTEMPTS,
      },
    });

    if (attempts >= ACCOUNT_LOCKOUT_MAX_ATTEMPTS) {
      this.securityAuditService.log({
        eventType: SecurityEventType.ACCOUNT_LOCKED,
        userId,
        email,
        ip: context?.ip,
        details: {
          lockoutDurationMinutes: ACCOUNT_LOCKOUT_DURATION_SECONDS / 60,
        },
      });
    }
  }

  private async clearLoginAttempts(email: string): Promise<void> {
    const key = `${LOGIN_ATTEMPTS_KEY_PREFIX}${email}`;
    await this.redisService.del(key);
  }

  private async generateTokens(user: {
    id: string;
    email: string;
    role: Role;
  }) {
    const accessTokenPayload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const tokenId = randomUUID();
    const refreshTokenPayload: RefreshTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenId,
    };

    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!accessSecret || !refreshSecret) {
      throw new Error('JWT secrets are not configured');
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessTokenPayload, {
        secret: accessSecret,
        expiresIn: JWT_ACCESS_TOKEN_EXPIRATION,
      }),
      this.jwtService.signAsync(refreshTokenPayload, {
        secret: refreshSecret,
        expiresIn: JWT_REFRESH_TOKEN_EXPIRATION,
      }),
    ]);

    return { accessToken, refreshToken } as const;
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const refreshTokenExpiration = 7 * 24 * 60 * 60;
    await this.redisService.set(
      `refresh_token:${userId}`,
      refreshToken,
      refreshTokenExpiration,
    );
  }
}
