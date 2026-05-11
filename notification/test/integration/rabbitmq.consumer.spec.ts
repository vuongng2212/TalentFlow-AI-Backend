import { Channel, ConsumeMessage } from 'amqplib';
import { NotificationService } from '../../src/notification/notification.service';
import { NOTIFICATION_SEND_ROUTING_KEY } from '../../src/rabbitmq/events';
import { NotificationConsumer } from '../../src/rabbitmq/notification.consumer';
import { RabbitmqService } from '../../src/rabbitmq/rabbitmq.service';

describe('NotificationConsumer Integration', () => {
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

  function makeMsg(
    content: object | string,
    routingKey: string,
  ): ConsumeMessage {
    const body =
      typeof content === 'string' ? content : JSON.stringify(content);

    return {
      content: Buffer.from(body, 'utf8'),
      fields: {
        deliveryTag: 1,
        routingKey,
        exchange: 'talentflow.events',
      },
      properties: {},
    } as ConsumeMessage;
  }

  it('processes full event pipeline: notification.send -> email', async () => {
    notificationService.sendFromEvent.mockResolvedValue({ success: true });
    const msg = makeMsg(
      {
        userId: 'user-1',
        to: 'integ@test.com',
        subject: 'Integration Test',
        body: 'Hello from integration',
        type: 'email',
      },
      NOTIFICATION_SEND_ROUTING_KEY,
    );
    channel.consume.mockImplementation((_queue, handler) => {
      void handler(msg);
      return { consumerTag: 'integ-tag' } as never;
    });

    await consumer.onModuleInit();

    expect(notificationService.sendFromEvent).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'integ@test.com' }),
    );
    expect(channel.ack).toHaveBeenCalledWith(msg);
  });

  it('does not crash when channel is unavailable during destroy', async () => {
    channel.consume.mockResolvedValue({ consumerTag: 'tag-x' });
    await consumer.onModuleInit();

    channel.cancel.mockRejectedValue(new Error('channel closed'));

    await expect(consumer.onModuleDestroy()).resolves.toBeUndefined();
  });
});
