import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN,
}));

export type JwtConfig = ReturnType<typeof jwtConfig>;
