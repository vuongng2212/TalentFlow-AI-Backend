import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';
import { ApplicationsService } from '../applications/applications.service';
import { sanitizeError } from '../common/utils/sanitize.util';
import {
  TALENTFLOW_EVENTS_EXCHANGE,
  CV_PROCESSING_QUEUE,
  CV_PARSING_DLQ,
  ROUTING_KEY_CV_UPLOADED,
  ROUTING_KEY_WORKSPACE_MEMBER_INVITED,
  ROUTING_KEY_APPLICATION_CREATED,
  ROUTING_KEY_NOTIFICATION_SEND,
  ROUTING_KEY_CV_PARSED,
  ROUTING_KEY_CV_FAILED,
  ROUTING_KEY_APPLICATION_CV_PROCESSED_SUCCESSFULLY,
  ROUTING_KEY_APPLICATION_CV_PROCESSED_FAILED,
} from './constants/queue.constants';
import { CvUploadedEvent } from './interfaces/cv-uploaded-event.interface';
import { WorkspaceMemberInvitedEvent } from './interfaces/workspace-member-invited-event.interface';
import { ApplicationCreatedEvent } from './interfaces/application-created-event.interface';
import { NotificationSendEvent } from './interfaces/notification-send-event.interface';
import {
  EnrichedCvParsedEvent,
  EnrichedCvFailedEvent,
  RawCvParsedEvent,
  RawCvFailedEvent,
} from './interfaces/cv-events.interface';

interface AmqpConnection {
  createChannel(): Promise<AmqpChannel>;
  on(event: 'error', listener: (err: Error) => void): void;
  on(event: 'close', listener: () => void): void;
  close(): Promise<void>;
}

const DEFAULT_RECONNECT_INITIAL_DELAY_MS = 1000;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 30000;
const DEFAULT_HEARTBEAT_SEC = 30;

export interface QueueStats {
  queue: string;
  messageCount: number;
  consumerCount: number;
}

interface AmqpChannel {
  assertExchange(
    exchange: string,
    type: string,
    options: { durable: boolean },
  ): Promise<unknown>;
  assertQueue(
    queue: string,
    options: {
      durable: boolean;
      deadLetterExchange?: string;
      deadLetterRoutingKey?: string;
    },
  ): Promise<unknown>;
  bindQueue(queue: string, source: string, pattern: string): Promise<unknown>;
  publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options: {
      persistent: boolean;
      contentType: string;
      timestamp: number;
    },
  ): boolean;
  checkQueue(
    queue: string,
  ): Promise<{ queue: string; messageCount: number; consumerCount: number }>;
  close(): Promise<void>;
  consume(
    queue: string,
    onMessage: (msg: unknown) => void | Promise<void>,
    options?: unknown,
  ): Promise<unknown>;
  ack(msg: unknown): void;
  nack(msg: unknown, allUpTo?: boolean, requeue?: boolean): void;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private connection: AmqpConnection | null = null;
  private channel: AmqpChannel | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;
  private isShuttingDown = false;
  private readonly logger = new Logger(QueueService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => ApplicationsService))
    private readonly applicationsService: ApplicationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.connectWithSetup();
  }

  private async connectWithSetup(): Promise<void> {
    try {
      await this.connect();
      await this.setupTopology();
      await this.setupConsumers();
      this.reconnectAttempt = 0;
      this.logger.log('RabbitMQ connection established');
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ', sanitizeError(error));
      await this.safeCloseCurrentConnection();
      this.scheduleReconnect();
    }
  }

  private getConnectionOptions(timeoutMs: number) {
    const heartbeatSec = this.configService.get<number>(
      'RABBITMQ_HEARTBEAT_SEC',
      DEFAULT_HEARTBEAT_SEC,
    );

    return {
      timeout: timeoutMs,
      heartbeat: heartbeatSec,
    };
  }

  private async connect(): Promise<void> {
    const url = this.configService.get<string>('RABBITMQ_URL');
    if (!url) {
      throw new Error('RABBITMQ_URL environment variable is not defined');
    }

    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'production' && !url.toLowerCase().startsWith('amqps://')) {
      throw new Error('RABBITMQ_URL must use amqps:// in production');
    }

    const timeoutMs = this.configService.get<number>('TIMEOUT_MS', 15000);

    const connection = (await connect(
      url,
      this.getConnectionOptions(timeoutMs),
    )) as unknown as AmqpConnection;

    this.connection = connection;
    this.channel = await connection.createChannel();

    this.connection.on('error', (err: Error) => {
      this.logger.error('RabbitMQ connection error', sanitizeError(err));
      this.handleConnectionLost();
    });

    this.connection.on('close', () => {
      this.logger.warn('RabbitMQ connection closed');
      this.handleConnectionLost();
    });
  }

  private cleanupConnectionState(): {
    channel: AmqpChannel | null;
    connection: AmqpConnection | null;
  } {
    const channel = this.channel;
    const connection = this.connection;

    this.channel = null;
    this.connection = null;

    return { channel, connection };
  }

  private handleConnectionLost(): void {
    if (this.isShuttingDown) {
      return;
    }

    const { channel, connection } = this.cleanupConnectionState();

    void this.safeCloseResources(channel, connection).finally(() => {
      this.scheduleReconnect();
    });
  }

  private async safeCloseCurrentConnection(): Promise<void> {
    const { channel, connection } = this.cleanupConnectionState();
    await this.safeCloseResources(channel, connection);
  }

  private async safeCloseResources(
    channel: AmqpChannel | null,
    connection: AmqpConnection | null,
  ): Promise<void> {
    try {
      await channel?.close();
    } catch (error) {
      this.logger.warn(
        'Failed to close RabbitMQ channel',
        sanitizeError(error),
      );
    }

    try {
      await connection?.close();
    } catch (error) {
      this.logger.warn(
        'Failed to close RabbitMQ connection',
        sanitizeError(error),
      );
    }
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown || this.reconnectTimer) {
      return;
    }

    const initialDelayMs = this.configService.get<number>(
      'RABBITMQ_RECONNECT_INITIAL_DELAY_MS',
      DEFAULT_RECONNECT_INITIAL_DELAY_MS,
    );
    const maxDelayMs = this.configService.get<number>(
      'RABBITMQ_RECONNECT_MAX_DELAY_MS',
      DEFAULT_RECONNECT_MAX_DELAY_MS,
    );

    const baseDelayMs = Math.min(
      maxDelayMs,
      initialDelayMs * Math.pow(2, this.reconnectAttempt),
    );
    const jitterMs = Math.floor(Math.random() * Math.max(1, baseDelayMs * 0.2));
    const delayMs = Math.min(maxDelayMs, baseDelayMs + jitterMs);
    this.reconnectAttempt += 1;

    this.logger.warn(`Scheduling RabbitMQ reconnect in ${delayMs}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connectWithSetup();
    }, delayMs);
    this.reconnectTimer.unref?.();
  }

  private async setupTopology(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    await this.channel.assertExchange(TALENTFLOW_EVENTS_EXCHANGE, 'topic', {
      durable: true,
    });

    await this.channel.assertQueue(CV_PARSING_DLQ, {
      durable: true,
    });

    await this.channel.assertQueue(CV_PROCESSING_QUEUE, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: CV_PARSING_DLQ,
    });

    await this.channel.bindQueue(
      CV_PROCESSING_QUEUE,
      TALENTFLOW_EVENTS_EXCHANGE,
      ROUTING_KEY_CV_UPLOADED,
    );

    await this.channel.bindQueue(
      CV_PROCESSING_QUEUE,
      TALENTFLOW_EVENTS_EXCHANGE,
      ROUTING_KEY_CV_PARSED,
    );

    await this.channel.bindQueue(
      CV_PROCESSING_QUEUE,
      TALENTFLOW_EVENTS_EXCHANGE,
      ROUTING_KEY_CV_FAILED,
    );

    this.logger.log('RabbitMQ topology configured');
  }

  private async setupConsumers(): Promise<void> {
    if (!this.channel) return;

    await this.channel.consume(CV_PROCESSING_QUEUE, async (msg) => {
      if (!msg) return;

      try {
        const message = msg as {
          fields: { routingKey: string };
          content: Buffer;
        };
        const routingKey = message.fields.routingKey;
        const content = JSON.parse(message.content.toString()) as unknown;

        this.logger.log(`Received message with routing key: ${routingKey}`);

        switch (routingKey) {
          case ROUTING_KEY_CV_PARSED:
            await this.applicationsService.handleCvParsedEvent(
              content as RawCvParsedEvent,
            );
            break;
          case ROUTING_KEY_CV_FAILED:
            await this.applicationsService.handleCvFailedEvent(
              content as RawCvFailedEvent,
            );
            break;
          default:
            this.logger.debug(
              `Ignoring message with routing key: ${routingKey}`,
            );
        }

        this.channel?.ack(msg);
      } catch (error) {
        this.logger.error('Error processing message', sanitizeError(error));
        this.channel?.nack(msg, false, false);
      }
    });
  }

  private publishEvent<T>(
    routingKey: string,
    event: T,
    logLabel: string,
  ): Promise<void> {
    if (!this.channel) {
      this.logger.error('Cannot publish: channel not initialized');
      throw new Error('RabbitMQ channel not initialized');
    }

    const message = Buffer.from(JSON.stringify(event));

    const published = this.channel.publish(
      TALENTFLOW_EVENTS_EXCHANGE,
      routingKey,
      message,
      {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
      },
    );

    if (!published) {
      this.logger.error('Message was not published - channel buffer full');
      throw new Error('RabbitMQ outbound buffer full');
    }

    this.logger.log(`Published ${logLabel}`);
    return Promise.resolve();
  }

  async publishCvUploaded(event: CvUploadedEvent): Promise<void> {
    await this.publishEvent(
      ROUTING_KEY_CV_UPLOADED,
      event,
      `cv.uploaded event for application ${event.applicationId}`,
    );
  }

  async publishWorkspaceMemberInvited(
    event: WorkspaceMemberInvitedEvent,
  ): Promise<void> {
    await this.publishEvent(
      ROUTING_KEY_WORKSPACE_MEMBER_INVITED,
      event,
      `workspace.member.invited event for ${event.email}`,
    );
  }

  async publishApplicationCreated(
    event: ApplicationCreatedEvent,
  ): Promise<void> {
    await this.publishEvent(
      ROUTING_KEY_APPLICATION_CREATED,
      event,
      `application.created event for application ${event.applicationId}`,
    );
  }

  async publishNotificationSend(event: NotificationSendEvent): Promise<void> {
    await this.publishEvent(
      ROUTING_KEY_NOTIFICATION_SEND,
      event,
      `notification.send event for user ${event.userId}`,
    );
  }

  async publishEnrichedCvParsed(event: EnrichedCvParsedEvent): Promise<void> {
    await this.publishEvent(
      ROUTING_KEY_APPLICATION_CV_PROCESSED_SUCCESSFULLY,
      event,
      `enriched cv.success event for application ${event.applicationId}`,
    );
  }

  async publishEnrichedCvFailed(event: EnrichedCvFailedEvent): Promise<void> {
    await this.publishEvent(
      ROUTING_KEY_APPLICATION_CV_PROCESSED_FAILED,
      event,
      `enriched cv.failed event for application ${event.applicationId}`,
    );
  }

  isHealthy(): Promise<boolean> {
    return Promise.resolve(this.connection !== null && this.channel !== null);
  }

  async getQueueStats(): Promise<QueueStats[]> {
    if (!this.channel) {
      return [];
    }

    try {
      const [mainQueue, dlq] = await Promise.all([
        this.channel.checkQueue(CV_PROCESSING_QUEUE),
        this.channel.checkQueue(CV_PARSING_DLQ),
      ]);

      return [mainQueue, dlq];
    } catch (error) {
      this.logger.error('Failed to get queue stats', sanitizeError(error));
      return [];
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      await this.channel?.close();
      await this.connection?.close();
      this.cleanupConnectionState();
      this.logger.log('RabbitMQ connection closed gracefully');
    } catch (error) {
      this.logger.error(
        'Error closing RabbitMQ connection',
        sanitizeError(error),
      );
    }
  }
}
