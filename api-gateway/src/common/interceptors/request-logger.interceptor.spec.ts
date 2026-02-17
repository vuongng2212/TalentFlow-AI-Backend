/* eslint-disable @typescript-eslint/unbound-method */
import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { RequestLoggerInterceptor } from './request-logger.interceptor';

describe('RequestLoggerInterceptor', () => {
  let interceptor: RequestLoggerInterceptor;

  beforeEach(() => {
    interceptor = new RequestLoggerInterceptor();
    // Mock Logger methods
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMockContext = (
    method = 'GET',
    url = '/test',
    statusCode = 200,
    requestId?: string,
  ): ExecutionContext => {
    const headers: Record<string, string | undefined> = {};
    if (requestId) {
      headers['x-request-id'] = requestId;
    }

    const mockRequest = {
      method,
      url,
      headers,
    };

    const mockResponse = {
      statusCode,
      setHeader: jest.fn(),
    };

    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    };
  };

  const createMockCallHandler = (data: unknown): CallHandler => ({
    handle: jest.fn().mockReturnValue(of(data)),
  });

  const createErrorCallHandler = (error: Error): CallHandler => ({
    handle: jest.fn().mockReturnValue(throwError(() => error)),
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should log successful request', (done) => {
      const mockContext = createMockContext('GET', '/api/users', 200);
      const mockCallHandler = createMockCallHandler({ data: 'test' });

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          expect(Logger.prototype.log).toHaveBeenCalled();
          done();
        },
        error: done.fail,
      });
    });

    it('should set x-request-id header on response', (done) => {
      const mockContext = createMockContext('GET', '/api/users', 200);
      const mockCallHandler = createMockCallHandler({ data: 'test' });
      const mockResponse = mockContext.switchToHttp().getResponse();

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'x-request-id',
            expect.any(String),
          );
          done();
        },
        error: done.fail,
      });
    });

    it('should preserve existing x-request-id from request header', (done) => {
      const customId = 'custom-request-123';
      const mockContext = createMockContext(
        'GET',
        '/api/users',
        200,
        customId,
      );
      const mockCallHandler = createMockCallHandler({ data: 'test' });
      const mockResponse = mockContext.switchToHttp().getResponse();

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'x-request-id',
            customId,
          );
          done();
        },
        error: done.fail,
      });
    });

    it('should log error request', (done) => {
      const mockContext = createMockContext('POST', '/api/error', 500);
      const testError = new Error('Test error');
      const mockCallHandler = createErrorCallHandler(testError);

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        error: () => {
          expect(Logger.prototype.error).toHaveBeenCalled();
          done();
        },
      });
    });

    it('should log POST request', (done) => {
      const mockContext = createMockContext('POST', '/api/users', 201);
      const mockCallHandler = createMockCallHandler({ id: 1 });

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          expect(Logger.prototype.log).toHaveBeenCalled();
          done();
        },
        error: done.fail,
      });
    });

    it('should generate UUID when no request id provided', (done) => {
      const mockContext = createMockContext('GET', '/api/test', 200);
      const mockCallHandler = createMockCallHandler({ data: 'test' });
      const mockResponse = mockContext.switchToHttp().getResponse();

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'x-request-id',
            expect.stringMatching(
              /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
            ),
          );
          done();
        },
        error: done.fail,
      });
    });

    it('should handle request with array header value', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'GET',
            url: '/test',
            headers: { 'x-request-id': ['array-id-1', 'array-id-2'] },
          }),
          getResponse: jest.fn().mockReturnValue({
            statusCode: 200,
            setHeader: jest.fn(),
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
        getType: jest.fn(),
      };
      const mockCallHandler = createMockCallHandler({ data: 'test' });
      const mockResponse = mockContext.switchToHttp().getResponse();

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'x-request-id',
            'array-id-1',
          );
          done();
        },
        error: done.fail,
      });
    });

    it('should use request.id when available', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'GET',
            url: '/test',
            headers: {},
            id: 'express-request-id',
          }),
          getResponse: jest.fn().mockReturnValue({
            statusCode: 200,
            setHeader: jest.fn(),
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
        getType: jest.fn(),
      };
      const mockCallHandler = createMockCallHandler({ data: 'test' });
      const mockResponse = mockContext.switchToHttp().getResponse();

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'x-request-id',
            'express-request-id',
          );
          done();
        },
        error: done.fail,
      });
    });
  });
});
