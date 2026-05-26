import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  INVALID_JWT_PAYLOAD_MESSAGE,
  toAuthenticatedUser,
} from './jwt-user.util';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('jwt.accessSecret');
    const algorithms = ['HS256'];

    if (!secret) {
      throw new Error('JWT auth configuration is incomplete');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    try {
      return toAuthenticatedUser(payload);
    } catch {
      throw new UnauthorizedException(INVALID_JWT_PAYLOAD_MESSAGE);
    }
  }
}
