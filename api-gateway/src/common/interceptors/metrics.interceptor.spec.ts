/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-member-access */
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from '../../metrics/metrics.service';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;
  let metricsService: MetricsService;

  const mockMetricsService = {
    recordRequest: jest.fn(),
  };

  const createMockContext = (
    method = 'GET',
    url = '/test',
    statusCode = 200,
  ): ExecutionContext => {
    const mockRequest = {
      method,
      originalUrl: url,
      url,
    };
    const mockResponse = {
      statusCode,
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

  beforeEach(() => {
    jest.clearAllMocks();
    metricsService = mockMetricsService as unknown as MetricsService;
    interceptor = new MetricsInterceptor(metricsService);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should record metrics for successful request', (done) => {
      const mockContext = createMockContext('GET', '/api/users', 200);
      const mockCallHandler = createMockCallHandler({ data: 'test' });

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          expect(metricsService.recordRequest).toHaveBeenCalledWith(
            'GET',
            '/api/users',
            200,
            expect.any(Number),
          );
          done();
        },
        error: done.fail,
      });
    });

    it('should record metrics for POST request', (done) => {
      const mockContext = createMockContext('POST', '/api/users', 201);
      const mockCallHandler = createMockCallHandler({ id: 1 });

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          expect(metricsService.recordRequest).toHaveBeenCalledWith(
            'POST',
            '/api/users',
            201,
            expect.any(Number),
          );
          done();
        },
        error: done.fail,
      });
    });

    it('should record metrics on error', (done) => {
      const mockContext = createMockContext('GET', '/api/error', 500);
      const mockCallHandler = createErrorCallHandler(new Error('Test error'));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        error: () => {
          expect(metricsService.recordRequest).toHaveBeenCalledWith(
            'GET',
            '/api/error',
            500,
            expect.any(Number),
          );
          done();
        },
      });
    });

    it('should record duration in seconds', (done) => {
      const mockContext = createMockContext('GET', '/api/test', 200);
      const mockCallHandler = createMockCallHandler({ data: 'test' });

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          const durationArg = (metricsService.recordRequest as jest.Mock).mock
            .calls[0][3] as number;
          expect(durationArg).toBeGreaterThanOrEqual(0);
          expect(durationArg).toBeLessThan(1); // Should be less than 1 second
          done();
        },
        error: done.fail,
      });
    });

    it('should use fallback values for missing request properties', (done) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({}),
          getResponse: jest.fn().mockReturnValue({}),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
        getType: jest.fn(),
      };
      const mockCallHandler = createMockCallHandler({});

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          expect(metricsService.recordRequest).toHaveBeenCalledWith(
            'UNKNOWN',
            'unknown',
            500,
            expect.any(Number),
          );
          done();
        },
        error: done.fail,
      });
    });
  });
});
