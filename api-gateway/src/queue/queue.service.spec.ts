import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';
import { QueueService } from './queue.service';
import {
  TALENTFLOW_EVENTS_EXCHANGE,
  CV_PARSING_DLQ,
  CV_PROCESSING_QUEUE,
  ROUTING_KEY_CV_UPLOADED,
} from './constants/queue.constants';

const mockChannel = {
  assertExchange: jest.fn(),
  assertQueue: jest.fn(),
  bindQueue: jest.fn(),
  publish: jest.fn(),
  checkQueue: jest.fn(),
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
  bucket: 'talentflow-cvs',
  fileKey: 'cvs/key.pdf',
  mimeType: 'application/pdf',
  uploadedAt: new Date().toISOString(),
};

jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

function getPrivateAsyncMethod<TResult>(
  instance: Record<string, unknown>,
  methodName: string,
): () => Promise<TResult> {
  const method = instance[methodName];

  if (typeof method !== 'function') {
    throw new Error(`Expected ${methodName} to be a function`);
  }

  return method.bind(instance) as () => Promise<TResult>;
}

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
      if (key === 'RABBITMQ_HEARTBEAT_SEC') return 30;
      if (key === 'RABBITMQ_RECONNECT_INITIAL_DELAY_MS') return 1000;
      if (key === 'RABBITMQ_RECONNECT_MAX_DELAY_MS') return 30000;
      if (key === 'NODE_ENV') return 'development';
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

    expect(connect).toHaveBeenCalledWith(
      'amqp://localhost:5672',
      expect.objectContaining({
        timeout: 15000,
        heartbeat: 30,
      }),
    );

    expect(jest.mocked(mockChannel.assertExchange)).toHaveBeenCalledWith(
      TALENTFLOW_EVENTS_EXCHANGE,
      'topic',
      { durable: true },
    );
    expect(jest.mocked(mockChannel.assertQueue)).toHaveBeenCalledWith(
      CV_PARSING_DLQ,
      {
        durable: true,
      },
    );
    expect(jest.mocked(mockChannel.assertQueue)).toHaveBeenCalledWith(
      CV_PROCESSING_QUEUE,
      {
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: CV_PARSING_DLQ,
      },
    );
    expect(jest.mocked(mockChannel.bindQueue)).toHaveBeenCalledWith(
      CV_PROCESSING_QUEUE,
      TALENTFLOW_EVENTS_EXCHANGE,
      ROUTING_KEY_CV_UPLOADED,
    );
  });

  it('should publish cv.uploaded event', async () => {
    await service.onModuleInit();

    await service.publishCvUploaded(mockEvent);

    expect(jest.mocked(mockChannel.publish)).toHaveBeenCalledWith(
      TALENTFLOW_EVENTS_EXCHANGE,
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

    await expect(jest.mocked(service.isHealthy())).resolves.toBe(true);
  });

  it('should close channel and connection on destroy', async () => {
    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(jest.mocked(mockChannel.close)).toHaveBeenCalled();
    expect(jest.mocked(mockConnection.close)).toHaveBeenCalled();
  });

  it('should log and continue when module init fails', async () => {
    // We suppress console error logs for this test
    const logErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    (connect as jest.Mock).mockRejectedValueOnce(new Error('connect failed'));

    await expect(jest.mocked(service.onModuleInit())).resolves.toBeUndefined();

    expect(logErrorSpy).toHaveBeenCalledWith(
      'Failed to connect to RabbitMQ',
      expect.any(Object),
    );
  });

  it('should throw when publishing before channel initialization', async () => {
    const logErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await expect(
      jest.mocked(service.publishCvUploaded(mockEvent)),
    ).rejects.toThrow('RabbitMQ channel not initialized');

    expect(logErrorSpy).toHaveBeenCalledWith(
      'Cannot publish: channel not initialized',
    );
  });

  it('should throw when outbound buffer is full', async () => {
    const logErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await service.onModuleInit();
    mockChannel.publish.mockReturnValueOnce(false);

    await expect(
      jest.mocked(service.publishCvUploaded(mockEvent)),
    ).rejects.toThrow('RabbitMQ outbound buffer full');

    expect(logErrorSpy).toHaveBeenCalledWith(
      'Message was not published - channel buffer full',
    );
  });

  it('should throw when RABBITMQ_URL is missing', async () => {
    mockConfigGet.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'RABBITMQ_URL') return undefined;
      if (key === 'TIMEOUT_MS') return 15000;
      return defaultValue;
    });

    const connectMethod = getPrivateAsyncMethod<void>(
      service as unknown as Record<string, unknown>,
      'connect',
    );

    await expect(connectMethod()).rejects.toThrow(
      'RABBITMQ_URL environment variable is not defined',
    );
  });

  it('should throw when setupTopology is called without channel', async () => {
    const setupTopologyMethod = getPrivateAsyncMethod<void>(
      service as unknown as Record<string, unknown>,
      'setupTopology',
    );

    await expect(setupTopologyMethod()).rejects.toThrow(
      'Channel not initialized',
    );
  });

  it('should mark service unhealthy on connection error event', async () => {
    const logErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await service.onModuleInit();

    const errorListener = mockConnection.on.mock.calls.find(
      ([event]: [string]) => event === 'error',
    )?.[1] as ((err: Error) => void) | undefined;

    expect(errorListener).toBeDefined();
    errorListener?.(new Error('socket closed'));

    await expect(jest.mocked(service.isHealthy())).resolves.toBe(false);
    expect(logErrorSpy).toHaveBeenCalledWith(
      'RabbitMQ connection error',
      expect.any(Object),
    );
  });

  it('should mark service unhealthy on connection close event', async () => {
    await service.onModuleInit();

    const closeListener = mockConnection.on.mock.calls.find(
      ([event]: [string]) => event === 'close',
    )?.[1] as (() => void) | undefined;

    expect(closeListener).toBeDefined();
    closeListener?.();

    await expect(jest.mocked(service.isHealthy())).resolves.toBe(false);
  });

  it('should log error when destroy fails', async () => {
    await service.onModuleInit();
    const logErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    mockChannel.close.mockRejectedValueOnce(new Error('close failed'));

    await expect(
      jest.mocked(service.onModuleDestroy()),
    ).resolves.toBeUndefined();

    expect(logErrorSpy).toHaveBeenCalledWith(
      'Error closing RabbitMQ connection',
      expect.any(Object),
    );
  });

  describe('getQueueStats', () => {
    it('should return queue stats when channel is initialized', async () => {
      await service.onModuleInit();

      mockChannel.checkQueue.mockImplementation((queue: string) =>
        Promise.resolve({
          queue,
          messageCount: queue === CV_PROCESSING_QUEUE ? 10 : 2,
          consumerCount: queue === CV_PROCESSING_QUEUE ? 3 : 0,
        }),
      );

      const stats = await service.getQueueStats();

      expect(stats).toHaveLength(2);
      expect(stats[0]).toEqual({
        queue: CV_PROCESSING_QUEUE,
        messageCount: 10,
        consumerCount: 3,
      });
      expect(stats[1]).toEqual({
        queue: CV_PARSING_DLQ,
        messageCount: 2,
        consumerCount: 0,
      });
    });

    it('should return empty array when channel is not initialized', async () => {
      const stats = await service.getQueueStats();

      expect(stats).toEqual([]);
    });

    it('should return empty array and log error when checkQueue fails', async () => {
      await service.onModuleInit();
      const logErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      mockChannel.checkQueue.mockRejectedValueOnce(new Error('check failed'));

      const stats = await service.getQueueStats();

      expect(stats).toEqual([]);
      expect(logErrorSpy).toHaveBeenCalledWith(
        'Failed to get queue stats',
        expect.any(Object),
      );
    });
  });
});
