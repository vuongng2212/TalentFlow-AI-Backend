import { Channel, ConsumeMessage, Replies } from 'amqplib';
import { NotificationService } from '../notification/notification.service';
import {
  APPLICATION_CREATED_ROUTING_KEY,
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
      expect(channel.bindQueue).toHaveBeenCalledWith(
        'notification_queue',
        'talentflow.events',
        NOTIFICATION_SEND_ROUTING_KEY,
      );
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

    // Helper to wait for the async handler to complete
    async function setupAndHandle(msg: ConsumeMessage) {
      let resolveHandler: () => void;
      const handlerPromise = new Promise<void>((resolve) => {
        resolveHandler = resolve;
      });

      channel.consume.mockImplementationOnce(
        (_queue: string, handler: (msg: ConsumeMessage) => void) => {
          void handler(msg);
          resolveHandler();
          return Promise.resolve({
            consumerTag: 'test-tag',
          } satisfies Replies.Consume);
        },
      );

      await consumer.onModuleInit();
      await handlerPromise;
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
      notificationService.sendFromEvent.mockResolvedValue({ success: true });

      await setupAndHandle(msg);

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
          applicantEmail: 'candidate@example.com',
          applicantName: 'Jane Doe',
          appliedAt: new Date().toISOString(),
        },
        APPLICATION_CREATED_ROUTING_KEY,
      );
      notificationService.handleApplicationCreated.mockResolvedValue({
        success: true,
      });

      await setupAndHandle(msg);

      expect(notificationService.handleApplicationCreated).toHaveBeenCalledWith(
        expect.objectContaining({ applicationId: 'app-1' }),
      );
      expect(channel.ack).toHaveBeenCalledWith(msg);
    });

    it('NACKs when payload validation fails', async () => {
      const msg = makeMsg(
        {
          // Missing userId and to
          subject: 'Test',
          type: 'email',
        },
        NOTIFICATION_SEND_ROUTING_KEY,
      );

      await setupAndHandle(msg);

      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(notificationService.sendFromEvent).not.toHaveBeenCalled();
    });

    it('NACKs unknown routing key', async () => {
      const msg = makeMsg({}, 'unknown.event');

      await setupAndHandle(msg);

      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
    });
  });
});
