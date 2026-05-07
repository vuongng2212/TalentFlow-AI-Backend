import { Channel, ConsumeMessage } from 'amqplib';
import { NotificationService } from '../notification/notification.service';
import {
  APPLICATION_CREATED_ROUTING_KEY,
  CV_FAILED_ROUTING_KEY,
  CV_PARSED_ROUTING_KEY,
  NOTIFICATION_SEND_ROUTING_KEY,
} from './events';
import { NotificationConsumer } from './notification.consumer';
import { RabbitmqService } from './rabbitmq.service';

describe('NotificationConsumer', () => {
  let consumer: NotificationConsumer;
  let rabbitmqService: jest.Mocked<
    Pick<
      RabbitmqService,
      'getChannel' | 'getExchangeName' | 'getQueueName' | 'onReconnect'
    >
  >;
  let notificationService: jest.Mocked<
    Pick<
      NotificationService,
      | 'sendFromEvent'
      | 'handleApplicationCreated'
      | 'handleCvParsed'
      | 'handleCvFailed'
    >
  >;
  let channel: jest.Mocked<
    Pick<Channel, 'bindQueue' | 'consume' | 'ack' | 'nack' | 'cancel'>
  >;

  beforeEach(() => {
    channel = {
      bindQueue: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
      cancel: jest.fn(),
    };

    rabbitmqService = {
      getChannel: jest.fn().mockResolvedValue(channel),
      getExchangeName: jest.fn().mockReturnValue('talentflow.events'),
      getQueueName: jest.fn().mockReturnValue('notification_queue'),
      onReconnect: jest.fn(),
    };

    notificationService = {
      sendFromEvent: jest.fn(),
      handleApplicationCreated: jest.fn(),
      handleCvParsed: jest.fn(),
      handleCvFailed: jest.fn(),
    };

    consumer = new NotificationConsumer(
      rabbitmqService as unknown as RabbitmqService,
      notificationService as unknown as NotificationService,
    );
  });

  describe('onModuleInit', () => {
    it('registers reconnect callback and sets up consumer', async () => {
      channel.consume.mockResolvedValue({ consumerTag: 'tag-123' });

      await consumer.onModuleInit();

      expect(rabbitmqService.onReconnect).toHaveBeenCalledTimes(1);
      expect(channel.bindQueue).toHaveBeenCalledTimes(4);
      expect(channel.bindQueue).toHaveBeenCalledWith(
        'notification_queue',
        'talentflow.events',
        NOTIFICATION_SEND_ROUTING_KEY,
      );
      expect(channel.bindQueue).toHaveBeenCalledWith(
        'notification_queue',
        'talentflow.events',
        APPLICATION_CREATED_ROUTING_KEY,
      );
      expect(channel.consume).toHaveBeenCalledTimes(1);
      expect(channel.consume).toHaveBeenCalledWith(
        'notification_queue',
        expect.any(Function),
        { noAck: false },
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('cancels consumer if tag exists', async () => {
      channel.consume.mockResolvedValue({ consumerTag: 'tag-abc' });
      await consumer.onModuleInit();

      await consumer.onModuleDestroy();

      expect(channel.cancel).toHaveBeenCalledWith('tag-abc');
    });
  });

  describe('message handling', () => {
    function makeMsg(
      content: object | string,
      routingKey: string,
      deliveryTag = 1,
    ): ConsumeMessage {
      const body =
        typeof content === 'string' ? content : JSON.stringify(content);

      return {
        content: Buffer.from(body, 'utf8'),
        fields: {
          deliveryTag,
          routingKey,
          exchange: 'talentflow.events',
        },
        properties: {},
      } as ConsumeMessage;
    }

    it('routes notification.send event to sendFromEvent and ACKs', async () => {
      const msg = makeMsg(
        {
          userId: 'u1',
          to: 'test@example.com',
          subject: 'Test',
          body: 'Hello',
          type: 'email',
        },
        NOTIFICATION_SEND_ROUTING_KEY,
      );
      channel.consume.mockImplementation((_queue, handler) => {
        void handler(msg);
        return { consumerTag: 't1' } as never;
      });
      notificationService.sendFromEvent.mockResolvedValue({
        success: true,
      });

      await consumer.onModuleInit();

      expect(notificationService.sendFromEvent).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'test@example.com' }),
      );
      expect(channel.ack).toHaveBeenCalledWith(msg);
    });

    it('routes application.created event to handleApplicationCreated and ACKs', async () => {
      const msg = makeMsg(
        {
          applicationId: 'app-1',
          jobId: 'job-1',
          jobTitle: 'Engineer',
          applicantId: 'u1',
          applicantEmail: 'c@ex.com',
          applicantName: 'Jane',
          appliedAt: '2026-05-07',
        },
        APPLICATION_CREATED_ROUTING_KEY,
      );
      channel.consume.mockImplementation((_queue, handler) => {
        void handler(msg);
        return { consumerTag: 't2' } as never;
      });
      notificationService.handleApplicationCreated.mockResolvedValue({
        success: true,
      });

      await consumer.onModuleInit();

      expect(notificationService.handleApplicationCreated).toHaveBeenCalledWith(
        expect.objectContaining({ applicationId: 'app-1' }),
      );
      expect(channel.ack).toHaveBeenCalledWith(msg);
    });

    it('routes cv.parsed event to handleCvParsed and ACKs', async () => {
      const msg = makeMsg(
        {
          applicationId: 'app-2',
          applicantEmail: 'cv@ex.com',
          applicantName: 'Bob',
          jobTitle: 'Dev',
          score: 85,
          parsedAt: '2026-05-07',
        },
        CV_PARSED_ROUTING_KEY,
      );
      channel.consume.mockImplementation((_queue, handler) => {
        void handler(msg);
        return { consumerTag: 't3' } as never;
      });
      notificationService.handleCvParsed.mockResolvedValue({
        success: true,
      });

      await consumer.onModuleInit();

      expect(notificationService.handleCvParsed).toHaveBeenCalledWith(
        expect.objectContaining({ applicationId: 'app-2', score: 85 }),
      );
      expect(channel.ack).toHaveBeenCalledWith(msg);
    });

    it('routes cv.failed event to handleCvFailed and ACKs', async () => {
      const msg = makeMsg(
        {
          applicationId: 'app-3',
          applicantEmail: 'fail@ex.com',
          applicantName: 'Tom',
          jobTitle: 'QA',
          reason: 'Unsupported format',
          failedAt: '2026-05-07',
        },
        CV_FAILED_ROUTING_KEY,
      );
      channel.consume.mockImplementation((_queue, handler) => {
        void handler(msg);
        return { consumerTag: 't4' } as never;
      });
      notificationService.handleCvFailed.mockResolvedValue({
        success: true,
      });

      await consumer.onModuleInit();

      expect(notificationService.handleCvFailed).toHaveBeenCalledWith(
        expect.objectContaining({ applicationId: 'app-3' }),
      );
      expect(channel.ack).toHaveBeenCalledWith(msg);
    });

    it('NACKs with requeue=false on malformed JSON', async () => {
      const msg = makeMsg('{ invalid }', NOTIFICATION_SEND_ROUTING_KEY);
      channel.consume.mockImplementation((_queue, handler) => {
        void handler(msg);
        return { consumerTag: 't5' } as never;
      });

      await consumer.onModuleInit();

      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(notificationService.sendFromEvent).not.toHaveBeenCalled();
    });

    it('NACKs with requeue=false when handler throws', async () => {
      const msg = makeMsg(
        {
          userId: 'u1',
          to: 'test@example.com',
          subject: 'Test',
          body: 'Hello',
          type: 'email',
        },
        NOTIFICATION_SEND_ROUTING_KEY,
      );
      channel.consume.mockImplementation((_queue, handler) => {
        void handler(msg);
        return { consumerTag: 't6' } as never;
      });
      notificationService.sendFromEvent.mockRejectedValue(
        new Error('SMTP failure'),
      );

      await consumer.onModuleInit();

      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
    });

    it('NACKs unknown routing key', async () => {
      const msg = makeMsg({}, 'unknown.event');
      channel.consume.mockImplementation((_queue, handler) => {
        void handler(msg);
        return { consumerTag: 't7' } as never;
      });

      await consumer.onModuleInit();

      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
    });
  });
});
