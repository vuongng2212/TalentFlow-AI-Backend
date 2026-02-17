/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  SecurityAuditService,
  SecurityEventType,
} from './security-audit.service';

describe('SecurityAuditService', () => {
  let service: SecurityAuditService;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new SecurityAuditService();
    logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
    warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should log LOGIN_SUCCESS events', () => {
      service.log({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        userId: 'user-123',
        email: 'test@example.com',
        ip: '192.168.1.1',
      });

      expect(logSpy).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should warn for LOGIN_FAILED events', () => {
      service.log({
        eventType: SecurityEventType.LOGIN_FAILED,
        email: 'test@example.com',
        ip: '192.168.1.1',
        details: { attempts: 3 },
      });

      expect(warnSpy).toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should warn for LOGIN_BLOCKED events', () => {
      service.log({
        eventType: SecurityEventType.LOGIN_BLOCKED,
        email: 'test@example.com',
      });

      expect(warnSpy).toHaveBeenCalled();
    });

    it('should warn for ACCOUNT_LOCKED events', () => {
      service.log({
        eventType: SecurityEventType.ACCOUNT_LOCKED,
        email: 'test@example.com',
        details: { lockoutDurationMinutes: 15 },
      });

      expect(warnSpy).toHaveBeenCalled();
    });

    it('should warn for UNAUTHORIZED_ACCESS events', () => {
      service.log({
        eventType: SecurityEventType.UNAUTHORIZED_ACCESS,
        ip: '192.168.1.1',
      });

      expect(warnSpy).toHaveBeenCalled();
    });

    it('should warn for TOKEN_REFRESH_FAILED events', () => {
      service.log({
        eventType: SecurityEventType.TOKEN_REFRESH_FAILED,
        userId: 'user-123',
        details: { reason: 'Invalid token' },
      });

      expect(warnSpy).toHaveBeenCalled();
    });

    it('should log SIGNUP events', () => {
      service.log({
        eventType: SecurityEventType.SIGNUP,
        userId: 'user-123',
        email: 'new@example.com',
        details: { role: 'RECRUITER' },
      });

      expect(logSpy).toHaveBeenCalled();
    });

    it('should log LOGOUT events', () => {
      service.log({
        eventType: SecurityEventType.LOGOUT,
        userId: 'user-123',
      });

      expect(logSpy).toHaveBeenCalled();
    });

    it('should log TOKEN_REFRESH events', () => {
      service.log({
        eventType: SecurityEventType.TOKEN_REFRESH,
        userId: 'user-123',
        ip: '192.168.1.1',
      });

      expect(logSpy).toHaveBeenCalled();
    });

    it('should mask email in log messages', () => {
      service.log({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        email: 'john.doe@example.com',
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('j***e@example.com'),
      );
    });

    it('should mask short emails correctly', () => {
      service.log({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        email: 'ab@test.com',
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('**@test.com'),
      );
    });

    it('should handle email without domain', () => {
      service.log({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        email: 'invalid-email',
      });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('***'));
    });

    it('should include all provided fields in log', () => {
      service.log({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        userId: 'user-123',
        email: 'test@example.com',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        details: { browser: 'Chrome' },
      });

      const logCall = logSpy.mock.calls[0][0];
      expect(logCall).toContain('[LOGIN_SUCCESS]');
      expect(logCall).toContain('userId=user-123');
      expect(logCall).toContain('ip=192.168.1.1');
      expect(logCall).toContain('details=');
    });

    it('should handle events without optional fields', () => {
      service.log({
        eventType: SecurityEventType.LOGOUT,
      });

      expect(logSpy).toHaveBeenCalledWith('[LOGOUT]');
    });
  });
});
