/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { Request, Response } from 'express';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: Partial<Response>;
  let mockRequest: Partial<Request>;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      getHeader: jest.fn(),
    };

    mockRequest = {
      headers: {},
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    };
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('catch', () => {
    it('should handle HttpException with string message', () => {
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 404,
          message: 'Not Found',
          timestamp: expect.any(String),
        }),
      );
    });

    it('should handle HttpException with object response', () => {
      const exception = new HttpException(
        { message: 'Validation error', error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          message: 'Validation error',
        }),
      );
    });

    it('should handle validation errors with array of messages', () => {
      const exception = new HttpException(
        { message: ['email must be valid', 'password is required'] },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          message: 'Validation failed',
          details: ['email must be valid', 'password is required'],
        }),
      );
    });

    it('should handle non-HttpException errors', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const exception = new Error('Something went wrong');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 500,
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should hide internal error details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const exception = new Error('Internal database error');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 500,
          message: 'Internal server error',
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should include requestId from request header', () => {
      mockRequest.headers = { 'x-request-id': 'test-request-123' };
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-request-123',
        }),
      );
    });

    it('should include requestId from response header', () => {
      (mockResponse.getHeader as jest.Mock).mockReturnValue(
        'response-header-id',
      );
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'response-header-id',
        }),
      );
    });

    it('should handle non-Error exceptions', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const exception = 'String error message';

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle HttpException with null response', () => {
      const exception = new HttpException(
        { message: null },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should set correct error name from status code', () => {
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Forbidden',
        }),
      );
    });
  });
});
