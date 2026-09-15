import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/auth-response.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  COOKIE_OPTIONS,
  ACCESS_TOKEN_COOKIE_MAX_AGE,
  REFRESH_TOKEN_COOKIE_MAX_AGE,
} from './constants/auth.constants';

interface UserPayload {
  id: string;
  email: string;
  role: string;
  fullName: string;
  tokenId?: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private extractContext(req: Request) {
    return {
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    };
  }

  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered.',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid input.' })
  @ApiResponse({ status: 409, description: 'Conflict - Email already in use.' })
  async signup(@Body() signupDto: SignupDto) {
    const user = await this.authService.signup(
      signupDto.email,
      signupDto.password,
      signupDto.fullName,
      signupDto.role,
    );

    return {
      message: 'User registered successfully',
      user,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns cookies.',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid credentials.',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const context = this.extractContext(req);
    const { accessToken, refreshToken, user } = await this.authService.login(
      loginDto.email,
      loginDto.password,
      context,
    );

    res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE,
    });

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
    });

    return {
      message: 'Login successful',
      user,
    };
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiResponse({ status: 200, description: 'Token successfully refreshed.' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired refresh token.',
  })
  async refresh(
    @CurrentUser() user: UserPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const context = this.extractContext(req);
    const { accessToken, refreshToken } = await this.authService.refresh(
      user.id,
      context,
    );

    res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE,
    });

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
    });

    return {
      message: 'Token refreshed successfully',
    };
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully.',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getProfile(@CurrentUser() user: UserPayload) {
    const profile = await this.authService.getProfile(user.id);
    return {
      user: profile,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout and clear cookies' })
  @ApiResponse({ status: 200, description: 'Logout successful.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async logout(
    @CurrentUser() user: UserPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const context = this.extractContext(req);
    await this.authService.logout(user.id, user.tokenId || '', context);

    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, COOKIE_OPTIONS);
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, COOKIE_OPTIONS);

    return {
      message: 'Logout successful',
    };
  }
}
