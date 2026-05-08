import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Channel, ConsumeMessage } from 'amqplib';
import { maskPii } from '../common/utils/pii-masker';
import { NotificationService } from '../notification/notification.service';
import { BINDING_KEYS, ROUTING_KEYS } from './rabbitmq.constants';
import { ApplicationCreatedEvent } from './events/application-created.event';
import { CvFailedEvent } from './events/cv-failed.event';
import { CvParsedEvent } from './events/cv-parsed.event';
import { NotificationSendEvent } from './events/notification-send.event';
import { RabbitmqService } from './rabbitmq.service';

@Injectable()
export class NotificationConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationConsumer.name);
  private channel: Channel | null = null;
  private consumerTag: string | null = null;
  private initialized = false;

  constructor(
    private readonly rabbitmqService: RabbitmqService,
    private readonly notificationService: NotificationService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.rabbitmqService.onReconnect(() => this.setupConsumer());
    await this.setupConsumer();
  }

  async onModuleDestroy(): Promise<void> {
    this.initialized = false;

    if (this.channel && this.consumerTag) {
      try {
        await this.channel.cancel(this.consumerTag);
        this.logger.log('Consumer cancelled');
      } catch (error) {
        this.logger.warn(
          `Failed to cancel consumer: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.channel = null;
    this.consumerTag = null;
  }

  private async setupConsumer(): Promise<void> {
    try {
      this.channel = await this.rabbitmqService.getChannel();
      const exchange = this.rabbitmqService.getExchangeName();
      const queue = this.rabbitmqService.getQueueName();

      for (const routingKey of BINDING_KEYS) {
        await this.channel.bindQueue(queue, exchange, routingKey);
        this.logger.log(
          `Bound "${queue}" to "${exchange}" with "${routingKey}"`,
        );
      }

      const { consumerTag } = await this.channel.consume(
        queue,
        (msg: ConsumeMessage | null) => void this.handleMessage(msg),
        { noAck: false },
      );

      this.consumerTag = consumerTag;
      this.initialized = true;
      this.logger.log(`Consumer started, tag=${consumerTag}`);
    } catch (error) {
      this.logger.error(
        `Failed to setup consumer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async handleMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg || !this.channel) {
      return;
    }

    const routingKey = msg.fields.routingKey;

    this.logger.debug(
      `Received event "${routingKey}" (deliveryTag=${msg.fields.deliveryTag})`,
    );

    let parsed: unknown;

    try {
      parsed = JSON.parse(msg.content.toString('utf8'));
    } catch {
      this.logger.warn(
        `Malformed JSON received for routingKey="${routingKey}". nacking with requeue=false.`,
        { content: msg.content.toString('utf8').substring(0, 200) }, // Log first 200 chars
      );
      this.channel.nack(msg, false, false);
      return;
    }

    try {
      await this.routeEvent(routingKey, parsed);
      this.channel.ack(msg);
    } catch (error) {
      this.logger.error(
        `Handler failed for "${routingKey}": ${maskPii(error instanceof Error ? error.message : String(error))}`,
      );
      this.channel.nack(msg, false, false);
    }
  }

  private async routeEvent(routingKey: string, data: unknown): Promise<void> {
    switch (routingKey) {
      case ROUTING_KEYS.NOTIFICATION_SEND:
        await this.notificationService.sendFromEvent(
          data as NotificationSendEvent,
        );
        break;
      case ROUTING_KEYS.APPLICATION_CREATED:
        await this.notificationService.handleApplicationCreated(
          data as ApplicationCreatedEvent,
        );
        break;
      case ROUTING_KEYS.CV_PARSED:
        await this.notificationService.handleCvParsed(data as CvParsedEvent);
        break;
      case ROUTING_KEYS.CV_FAILED:
        await this.notificationService.handleCvFailed(data as CvFailedEvent);
        break;
      default:
        this.logger.warn(`Unknown routing key: "${routingKey}"`);
        throw new Error(`Unknown routing key: ${routingKey}`);
    }
  }
}
