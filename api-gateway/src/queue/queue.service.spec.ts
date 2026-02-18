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

jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConnection.createChannel.mockResolvedValue(mockChannel);
    mockChannel.publish.mockReturnValue(true);

    (connect as jest.Mock).mockResolvedValue(mockConnection);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('amqp://localhost:5672'),
          },
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
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

    await service.publishCvUploaded({
      candidateId: 'candidate-1',
      applicationId: 'application-1',
      jobId: 'job-1',
      fileKey: 'cvs/key.pdf',
      fileUrl: 'http://localhost/file.pdf',
      mimeType: 'application/pdf',
      uploadedAt: new Date().toISOString(),
    });

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
});
