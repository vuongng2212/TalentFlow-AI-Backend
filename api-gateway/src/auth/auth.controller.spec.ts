import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Request, Response } from 'express';
import { Role } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    signup: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
  };

  const createMockResponse = (): Pick<Response, 'cookie' | 'clearCookie'> => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  });

  const createMockRequest = (
    overrides: Partial<Request> = {},
  ): Partial<Request> => ({
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' } as Request['socket'],
    get: jest.fn().mockReturnValue('Mozilla/5.0 Test User Agent'),
    ...overrides,
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
      const request = createMockRequest();

      const result = await controller.login(
        dto,
        request as Request,
        response as Response,
      );

      expect(jest.mocked(response.cookie)).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        message: 'Login successful',
        user: authResult.user,
      });
      expect(jest.mocked(mockAuthService.login)).toHaveBeenCalledWith(
        dto.email,
        dto.password,
        expect.objectContaining({
          ip: '127.0.0.1',
          userAgent: 'Mozilla/5.0 Test User Agent',
        }),
      );
    });
  });

  describe('refresh', () => {
    it('should refresh tokens and set cookies', async () => {
      const user = {
        id: 'uuid',
        email: 'test@example.com',
        role: 'RECRUITER',
        fullName: 'Test',
      };
      const authResult = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      mockAuthService.refresh.mockResolvedValue(authResult);
      const response = createMockResponse();
      const request = createMockRequest();

      const result = await controller.refresh(
        user,
        request as Request,
        response as Response,
      );

      expect(jest.mocked(response.cookie)).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        message: 'Token refreshed successfully',
      });
      expect(jest.mocked(mockAuthService.refresh)).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({
          ip: '127.0.0.1',
        }),
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const user = {
        id: 'uuid',
        email: 'test@example.com',
        role: 'RECRUITER',
        fullName: 'Test User',
      };

      const mockProfile = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        activeWorkspaceId: 'ws-123',
      };

      mockAuthService.getProfile.mockResolvedValue(mockProfile);

      const result = await controller.getProfile(user);

      expect(result).toEqual({
        user: mockProfile,
      });
      expect(jest.mocked(mockAuthService.getProfile)).toHaveBeenCalledWith(
        user.id,
      );
    });
  });

  describe('logout', () => {
    it('should clear cookies and logout', async () => {
      const user = {
        id: 'uuid',
        email: 'test@example.com',
        role: 'RECRUITER',
        fullName: 'Test',
        tokenId: 'token-id',
      };

      const response = createMockResponse();
      const request = createMockRequest();

      await controller.logout(user, request as Request, response as Response);

      expect(jest.mocked(mockAuthService.logout)).toHaveBeenCalledWith(
        user.id,
        user.tokenId,
        expect.objectContaining({
          ip: '127.0.0.1',
        }),
      );
      expect(jest.mocked(response.clearCookie)).toHaveBeenCalledTimes(2);
    });

    it('should handle logout without tokenId', async () => {
      const user = {
        id: 'uuid',
        email: 'test@example.com',
        role: 'RECRUITER',
        fullName: 'Test',
      };

      const response = createMockResponse();
      const request = createMockRequest();

      await controller.logout(user, request as Request, response as Response);

      expect(jest.mocked(mockAuthService.logout)).toHaveBeenCalledWith(
        user.id,
        '',
        expect.any(Object),
      );
    });
  });
});
