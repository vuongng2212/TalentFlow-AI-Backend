/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  const createMockContext = (statusCode = 200): ExecutionContext => {
    const mockResponse = { statusCode };
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn(),
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

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should transform simple data response', (done) => {
      const mockContext = createMockContext(200);
      const mockData = { id: 1, name: 'Test' };
      const mockCallHandler = createMockCallHandler(mockData);

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({
            status: 200,
            message: 'Success',
            data: mockData,
            timestamp: expect.any(String),
          });
          done();
        },
        error: done.fail,
      });
    });

    it('should extract message from data object', (done) => {
      const mockContext = createMockContext(201);
      const mockData = { message: 'Created successfully', id: 1 };
      const mockCallHandler = createMockCallHandler(mockData);

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({
            status: 201,
            message: 'Created successfully',
            data: { id: 1 },
            timestamp: expect.any(String),
          });
          done();
        },
        error: done.fail,
      });
    });

    it('should set data to null when only message in response', (done) => {
      const mockContext = createMockContext(200);
      const mockData = { message: 'Operation completed' };
      const mockCallHandler = createMockCallHandler(mockData);

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({
            status: 200,
            message: 'Operation completed',
            data: null,
            timestamp: expect.any(String),
          });
          done();
        },
        error: done.fail,
      });
    });

    it('should handle null data', (done) => {
      const mockContext = createMockContext(204);
      const mockCallHandler = createMockCallHandler(null);

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({
            status: 204,
            message: 'Success',
            data: null,
            timestamp: expect.any(String),
          });
          done();
        },
        error: done.fail,
      });
    });

    it('should handle array data', (done) => {
      const mockContext = createMockContext(200);
      const mockData = [{ id: 1 }, { id: 2 }];
      const mockCallHandler = createMockCallHandler(mockData);

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({
            status: 200,
            message: 'Success',
            data: mockData,
            timestamp: expect.any(String),
          });
          done();
        },
        error: done.fail,
      });
    });

    it('should handle string data', (done) => {
      const mockContext = createMockContext(200);
      const mockData = 'simple string';
      const mockCallHandler = createMockCallHandler(mockData);

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({
            status: 200,
            message: 'Success',
            data: 'simple string',
            timestamp: expect.any(String),
          });
          done();
        },
        error: done.fail,
      });
    });

    it('should include valid ISO timestamp', (done) => {
      const mockContext = createMockContext(200);
      const mockCallHandler = createMockCallHandler({ test: true });

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(() => new Date(result.timestamp)).not.toThrow();
          done();
        },
        error: done.fail,
      });
    });
  });
});
