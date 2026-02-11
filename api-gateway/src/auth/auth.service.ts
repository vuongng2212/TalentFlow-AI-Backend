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
  JWT_ACCESS_TOKEN_EXPIRATION,
  JWT_REFRESH_TOKEN_EXPIRATION,
} from './constants/auth.constants';
import { v4 as uuidv4 } from 'uuid';

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

interface RefreshTokenPayload extends TokenPayload {
  tokenId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signup(
    email: string,
    password: string,
    fullName: string,
    role: Role,
  ) {
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

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { accessToken, refreshToken } = await this.generateTokens(user);

    await this.storeRefreshToken(user.id, refreshToken);

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

  async refresh(userId: string, email: string) {
    const user = await this.usersService.findById(userId);

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('User not found');
    }

    const { accessToken, refreshToken } = await this.generateTokens(user);

    await this.storeRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
    };
  }

  async logout(userId: string, tokenId: string) {
    await this.redisService.del(`refresh_token:${userId}`);

    const refreshTokenExpiration = 7 * 24 * 60 * 60;
    await this.redisService.set(
      `blacklist:${tokenId}`,
      'true',
      refreshTokenExpiration,
    );
  }

  private async generateTokens(user: { id: string; email: string; role: Role }) {
    const accessTokenPayload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const tokenId = uuidv4();
    const refreshTokenPayload: RefreshTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessTokenPayload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: JWT_ACCESS_TOKEN_EXPIRATION,
      }),
      this.jwtService.signAsync(refreshTokenPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: JWT_REFRESH_TOKEN_EXPIRATION,
      }),
    ]);

    return { accessToken, refreshToken };
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
