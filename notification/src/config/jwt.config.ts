import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET ?? 'your-jwt-secret',
  expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  issuer: process.env.JWT_ISSUER ?? 'talentflow-api-gateway',
  audience: process.env.JWT_AUDIENCE ?? 'talentflow-notification-service',
}));

export type JwtConfig = ReturnType<typeof jwtConfig>;
