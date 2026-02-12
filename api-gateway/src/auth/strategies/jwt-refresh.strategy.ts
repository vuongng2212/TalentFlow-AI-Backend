import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';
import { RedisService } from '../../redis/redis.service';
import { REFRESH_TOKEN_COOKIE_NAME } from '../constants/auth.constants';

interface JwtRefreshPayload {
  sub: string;
  email: string;
  tokenId: string;
}

const cookieExtractor =
  (cookieName: string) =>
  (request: Request | undefined): string | null => {
    const cookies = request?.cookies as Record<string, string> | undefined;
    return cookies?.[cookieName] ?? null;
  };

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const secret = configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor(REFRESH_TOKEN_COOKIE_NAME),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(request: Request, payload: JwtRefreshPayload) {
    const token = cookieExtractor(REFRESH_TOKEN_COOKIE_NAME)(request);

    if (!token) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const storedToken = await this.redisService.get(
      `refresh_token:${payload.sub}`,
    );

    if (storedToken !== token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isBlacklisted = await this.redisService.exists(
      `blacklist:${payload.tokenId}`,
    );

    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return {
      id: payload.sub,
      email: payload.email,
      tokenId: payload.tokenId,
    } as const;
  }
}
