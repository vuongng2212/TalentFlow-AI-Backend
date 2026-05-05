import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN,
  issuer: process.env.JWT_ISSUER,
  audience: process.env.JWT_AUDIENCE,
}));

export type JwtConfig = ReturnType<typeof jwtConfig>;
