import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as amqplib from 'amqplib';
import { Channel, ChannelModel } from 'amqplib';
import { rabbitmqConfig } from '../src/config/rabbitmq.config';
import { NotificationService } from '../src/notification/notification.service';
import { NOTIFICATION_SEND_ROUTING_KEY } from '../src/rabbitmq/events';
import { NotificationConsumer } from '../src/rabbitmq/notification.consumer';
import { RabbitmqService } from '../src/rabbitmq/rabbitmq.service';

const shouldRunRabbitmqIntegration =
  process.env.RUN_RABBITMQ_INTEGRATION === 'true';

const describeRabbitmq = shouldRunRabbitmqIntegration
  ? describe
  : describe.skip;

describeRabbitmq('NotificationConsumer RabbitMQ integration', () => {
  let moduleRef: TestingModule;
  let publisherConnection: ChannelModel;
  let publisherChannel: Channel;
  let previousEnv: NodeJS.ProcessEnv;
  let notificationService: jest.Mocked<
    Pick<NotificationService, 'sendFromEvent'>
  >;

  const queueName = `notification_test_${Date.now()}`;
  const exchangeName = 'talentflow.events';
  const rabbitmqUrl =
    process.env.RABBITMQ_URL ?? 'amqp://rabbitmq:rabbitmq@localhost:5672';

  beforeAll(async () => {
    previousEnv = { ...process.env };
    process.env.RABBITMQ_URL = rabbitmqUrl;
    process.env.RABBITMQ_QUEUE = queueName;
    process.env.RABBITMQ_EXCHANGE = exchangeName;
    process.env.RABBITMQ_PREFETCH_COUNT = '1';

    notificationService = {
      sendFromEvent: jest.fn().mockResolvedValue({ success: true }),
    };

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [rabbitmqConfig],
        }),
      ],
      providers: [
        RabbitmqService,
        NotificationConsumer,
        {
          provide: NotificationService,
          useValue: notificationService,
        },
      ],
    }).compile();

    await moduleRef.init();

    publisherConnection = await amqplib.connect(rabbitmqUrl);
    publisherChannel = await publisherConnection.createChannel();
    await publisherChannel.assertExchange(exchangeName, 'topic', {
      durable: true,
    });
  });

  afterAll(async () => {
    await publisherChannel?.deleteQueue(queueName);
    await publisherChannel?.close();
    await publisherConnection?.close();
    await moduleRef?.close();
    process.env = previousEnv;
  });

  it('consumes a real RabbitMQ message and routes it to NotificationService', async () => {
    const payload = {
      userId: 'user-1',
      to: 'candidate@example.com',
      subject: 'RabbitMQ integration',
      body: 'Published through a real broker',
      type: 'email',
    };

    publisherChannel.publish(
      exchangeName,
      NOTIFICATION_SEND_ROUTING_KEY,
      Buffer.from(JSON.stringify(payload), 'utf8'),
      { persistent: false },
    );

    await waitFor(() => {
      expect(notificationService.sendFromEvent).toHaveBeenCalledWith(
        expect.objectContaining(payload),
      );
    });
  });
});

async function waitFor(assertion: () => void): Promise<void> {
  const deadline = Date.now() + 5000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw lastError;
}
