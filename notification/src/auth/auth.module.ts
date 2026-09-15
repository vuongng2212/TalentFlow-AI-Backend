import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { WsJwtGuard } from './ws-jwt.guard';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
    JwtModule.register({}),
  ],
  providers: [JwtStrategy, JwtAuthGuard, WsJwtGuard],
  exports: [PassportModule, JwtModule, JwtAuthGuard, WsJwtGuard],
})
export class AuthModule {}
