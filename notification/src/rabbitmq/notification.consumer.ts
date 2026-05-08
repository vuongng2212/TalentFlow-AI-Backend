import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Channel, ConsumeMessage } from 'amqplib';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { maskPii } from '../common/utils/pii-masker';
import { NotificationService } from '../notification/notification.service';
import { BINDING_KEYS, ROUTING_KEYS } from './rabbitmq.constants';
import { ApplicationCreatedDto } from './dtos/application-created.dto';
import { CvFailedDto } from './dtos/cv-failed.dto';
import { CvParsedDto } from './dtos/cv-parsed.dto';
import { NotificationSendDto } from './dtos/notification-send.dto';
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
    this.rabbitmqService.onReconnect(async () => {
      this.logger.log('Re-initializing consumer due to reconnection...');
      this.initialized = false;
      await this.setupConsumer();
    });
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
    if (this.initialized) {
      this.logger.log('Consumer is already initialized, skipping setup.');
      return;
    }

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
        { content: maskPii(msg.content.toString('utf8').substring(0, 200)) }, // Mask PII in first 200 chars
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
      case ROUTING_KEYS.NOTIFICATION_SEND: {
        const validated = await this.validatePayload(data, NotificationSendDto);
        await this.notificationService.sendFromEvent(validated);
        break;
      }
      case ROUTING_KEYS.APPLICATION_CREATED: {
        const validated = await this.validatePayload(
          data,
          ApplicationCreatedDto,
        );
        await this.notificationService.handleApplicationCreated(validated);
        break;
      }
      case ROUTING_KEYS.CV_PARSED: {
        const validated = await this.validatePayload(data, CvParsedDto);
        await this.notificationService.handleCvParsed(validated);
        break;
      }
      case ROUTING_KEYS.CV_FAILED: {
        const validated = await this.validatePayload(data, CvFailedDto);
        await this.notificationService.handleCvFailed(validated);
        break;
      }
      default:
        this.logger.warn(`Unknown routing key: "${routingKey}"`);
        throw new Error(`Unknown routing key: ${routingKey}`);
    }
  }

  private async validatePayload<T extends object>(
    data: unknown,
    DtoClass: new () => T,
  ): Promise<T> {
    const instance = plainToInstance(DtoClass, data);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const message = this.formatValidationErrors(errors);
      this.logger.error(`Validation failed for ${DtoClass.name}: ${message}`);
      throw new Error(`Validation failed: ${message}`);
    }

    return instance;
  }

  private formatValidationErrors(errors: ValidationError[]): string {
    return errors
      .map((error) => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join(', ')
          : 'Unknown constraint';
        return `${error.property}: ${constraints}`;
      })
      .join('; ');
  }
}
