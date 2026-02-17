import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const createMockContext = (user?: { role?: Role }): ExecutionContext => {
    const mockRequest = { user };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    };
  };

  beforeEach(() => {
    reflector = mockReflector as unknown as Reflector;
    guard = new RolesGuard(reflector);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true when no roles are required', () => {
      const mockContext = createMockContext({ role: Role.RECRUITER });
      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return true when user has required role', () => {
      const mockContext = createMockContext({ role: Role.ADMIN });
      mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });

    it('should return true when user has one of multiple required roles', () => {
      const mockContext = createMockContext({ role: Role.RECRUITER });
      mockReflector.getAllAndOverride.mockReturnValue([
        Role.ADMIN,
        Role.RECRUITER,
      ]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return false when user does not have required role', () => {
      const mockContext = createMockContext({ role: Role.RECRUITER });
      mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should return false when user is not present', () => {
      const mockContext = createMockContext(undefined);
      mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should return false when user.role is not present', () => {
      const mockContext = createMockContext({});
      mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should return true when roles is null', () => {
      const mockContext = createMockContext({ role: Role.RECRUITER });
      mockReflector.getAllAndOverride.mockReturnValue(null);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });
  });
});
