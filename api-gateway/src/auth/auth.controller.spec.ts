import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { Role } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    signup: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  const createMockResponse = (): Pick<Response, 'cookie' | 'clearCookie'> => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  });

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
      mockAuthService.signup.mockResolvedValue(expectedUser);

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

      mockAuthService.login.mockResolvedValue(authResult);
      const response = createMockResponse();

      const result = await controller.login(dto, response as Response);

      expect(response.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        message: 'Login successful',
        user: authResult.user,
      });
    });
  });

  describe('logout', () => {
    it('should clear cookies', async () => {
      const user = {
        id: 'uuid',
        email: 'test@example.com',
        role: 'RECRUITER',
        fullName: 'Test',
        tokenId: 'token-id',
      };

      const response = createMockResponse();
      await controller.logout(user, response as Response);

      expect(mockAuthService.logout).toHaveBeenCalledWith(
        user.id,
        user.tokenId,
      );
      expect(response.clearCookie).toHaveBeenCalledTimes(2);
    });
  });
});
