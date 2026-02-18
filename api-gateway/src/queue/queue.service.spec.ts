import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';
import { QueueService } from './queue.service';
import {
  CV_EVENTS_EXCHANGE,
  CV_PARSING_DLQ,
  CV_PROCESSING_QUEUE,
  ROUTING_KEY_CV_UPLOADED,
} from './constants/queue.constants';

const mockChannel = {
  assertExchange: jest.fn(),
  assertQueue: jest.fn(),
  bindQueue: jest.fn(),
  publish: jest.fn(),
  close: jest.fn(),
};

const mockConnection = {
  createChannel: jest.fn(),
  on: jest.fn(),
  close: jest.fn(),
};

const mockConfigGet = jest.fn();

const mockEvent = {
  candidateId: 'candidate-1',
  applicationId: 'application-1',
  jobId: 'job-1',
  fileKey: 'cvs/key.pdf',
  fileUrl: 'http://localhost/file.pdf',
  mimeType: 'application/pdf',
  uploadedAt: new Date().toISOString(),
};

jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConnection.createChannel.mockResolvedValue(mockChannel);
    mockConnection.on.mockImplementation(() => mockConnection);
    mockConnection.close.mockResolvedValue(undefined);

    mockChannel.publish.mockReturnValue(true);
    mockChannel.close.mockResolvedValue(undefined);

    (connect as jest.Mock).mockResolvedValue(mockConnection);

    mockConfigGet.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'RABBITMQ_URL') return 'amqp://localhost:5672';
      if (key === 'TIMEOUT_MS') return 15000;
      return defaultValue;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: ConfigService,
          useValue: {
            get: mockConfigGet,
          },
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should setup topology on module init', async () => {
    await service.onModuleInit();

    expect(mockChannel.assertExchange).toHaveBeenCalledWith(
      CV_EVENTS_EXCHANGE,
      'topic',
      { durable: true },
    );
    expect(mockChannel.assertQueue).toHaveBeenCalledWith(CV_PARSING_DLQ, {
      durable: true,
    });
    expect(mockChannel.assertQueue).toHaveBeenCalledWith(CV_PROCESSING_QUEUE, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: CV_PARSING_DLQ,
    });
    expect(mockChannel.bindQueue).toHaveBeenCalledWith(
      CV_PROCESSING_QUEUE,
      CV_EVENTS_EXCHANGE,
      ROUTING_KEY_CV_UPLOADED,
    );
  });

  it('should publish cv.uploaded event', async () => {
    await service.onModuleInit();

    await service.publishCvUploaded(mockEvent);

    expect(mockChannel.publish).toHaveBeenCalledWith(
      CV_EVENTS_EXCHANGE,
      ROUTING_KEY_CV_UPLOADED,
      expect.any(Buffer),
      expect.objectContaining({
        persistent: true,
        contentType: 'application/json',
      }),
    );
  });

  it('should report healthy after init', async () => {
    await service.onModuleInit();

    await expect(service.isHealthy()).resolves.toBe(true);
  });

  it('should close channel and connection on destroy', async () => {
    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(mockChannel.close).toHaveBeenCalled();
    expect(mockConnection.close).toHaveBeenCalled();
  });

  it('should log and continue when module init fails', async () => {
    const logErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    (connect as jest.Mock).mockRejectedValueOnce(new Error('connect failed'));

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(logErrorSpy).toHaveBeenCalledWith(
      'Failed to connect to RabbitMQ',
      expect.any(Object),
    );
  });

  it('should throw when publishing before channel initialization', async () => {
    await expect(service.publishCvUploaded(mockEvent)).rejects.toThrow(
      'RabbitMQ channel not initialized',
    );
  });

  it('should throw when outbound buffer is full', async () => {
    await service.onModuleInit();
    mockChannel.publish.mockReturnValueOnce(false);

    await expect(service.publishCvUploaded(mockEvent)).rejects.toThrow(
      'RabbitMQ outbound buffer full',
    );
  });

  it('should throw when RABBITMQ_URL is missing', async () => {
    mockConfigGet.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'RABBITMQ_URL') return undefined;
      if (key === 'TIMEOUT_MS') return 15000;
      return defaultValue;
    });

    await expect((service as any).connect()).rejects.toThrow(
      'RABBITMQ_URL environment variable is not defined',
    );
  });

  it('should throw when setupTopology is called without channel', async () => {
    await expect((service as any).setupTopology()).rejects.toThrow(
      'Channel not initialized',
    );
  });

  it('should mark service unhealthy on connection error event', async () => {
    await service.onModuleInit();

    const errorListener = mockConnection.on.mock.calls.find(
      ([event]: [string]) => event === 'error',
    )?.[1] as ((err: Error) => void) | undefined;

    expect(errorListener).toBeDefined();
    errorListener?.(new Error('socket closed'));

    await expect(service.isHealthy()).resolves.toBe(false);
  });

  it('should mark service unhealthy on connection close event', async () => {
    await service.onModuleInit();

    const closeListener = mockConnection.on.mock.calls.find(
      ([event]: [string]) => event === 'close',
    )?.[1] as (() => void) | undefined;

    expect(closeListener).toBeDefined();
    closeListener?.();

    await expect(service.isHealthy()).resolves.toBe(false);
  });

  it('should log error when destroy fails', async () => {
    await service.onModuleInit();
    const logErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    mockChannel.close.mockRejectedValueOnce(new Error('close failed'));

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();

    expect(logErrorSpy).toHaveBeenCalledWith(
      'Error closing RabbitMQ connection',
      expect.any(Object),
    );
  });
});
