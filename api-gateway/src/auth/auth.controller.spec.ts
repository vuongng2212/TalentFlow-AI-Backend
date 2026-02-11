import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { Role } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    signup: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('should register a user', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'Password123!',
        fullName: 'Test User',
        role: Role.RECRUITER,
      };

      const expectedUser = { id: 'uuid', ...dto };
      (mockAuthService.signup as jest.Mock).mockResolvedValue(expectedUser);

      const result = await controller.signup(dto);

      expect(result).toEqual({
        message: 'User registered successfully',
        user: expectedUser,
      });
    });
  });

  describe('login', () => {
    it('should login and set cookies', async () => {
      const dto = { email: 'test@example.com', password: 'Password123!' };
      const authResult = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 'uuid', email: dto.email },
      };

      (mockAuthService.login as jest.Mock).mockResolvedValue(authResult);

      const result = await controller.login(dto, mockResponse);

      expect(mockResponse.cookie).toHaveBeenCalledTimes(2); // Access and Refresh tokens
      expect(result).toEqual({
        message: 'Login successful',
        user: authResult.user,
      });
    });
  });

  describe('logout', () => {
    it('should clear cookies', async () => {
      const user = { id: 'uuid', email: 'test@example.com', role: 'RECRUITER', fullName: 'Test', tokenId: 'token-id' };

      await controller.logout(user, mockResponse);

      expect(mockAuthService.logout).toHaveBeenCalledWith(user.id, user.tokenId);
      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(2);
    });
  });
});
