import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';

interface AmqpConnection {
  createChannel(): Promise<AmqpChannel>;
  on(event: 'error', listener: (err: Error) => void): void;
  on(event: 'close', listener: () => void): void;
  close(): Promise<void>;
}

interface AmqpChannel {
  assertExchange(
    exchange: string,
    type: string,
    options: { durable: boolean },
  ): Promise<unknown>;
  close(): Promise<void>;
}

const DEFAULT_RECONNECT_INITIAL_DELAY_MS = 1000;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 30000;
const DEFAULT_HEARTBEAT_SEC = 30;
const NOTIFICATION_EXCHANGE = 'talentflow.events';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private connection: AmqpConnection | null = null;
  private channel: AmqpChannel | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;
  private isShuttingDown = false;
  private readonly logger = new Logger(RabbitmqService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connectWithSetup();
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    await this.safeCloseCurrentConnection();
  }

  async isHealthy(): Promise<boolean> {
    return this.connection !== null && this.channel !== null;
  }

  private async connectWithSetup(): Promise<void> {
    try {
      await this.connect();
      await this.setupTopology();
      this.reconnectAttempt = 0;
      this.logger.log('RabbitMQ connection established');
    } catch (error) {
      this.logger.error(
        `Failed to connect to RabbitMQ: ${error instanceof Error ? error.message : String(error)}`,
      );
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
    )) as AmqpConnection;

    this.connection = connection;
    this.channel = await connection.createChannel();

    this.connection.on('error', (err: Error) => {
      this.logger.error(`RabbitMQ connection error: ${err.message}`);
      this.handleConnectionLost();
    });

    this.connection.on('close', () => {
      this.logger.warn('RabbitMQ connection closed');
      this.handleConnectionLost();
    });
  }

  private async setupTopology(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    await this.channel.assertExchange(NOTIFICATION_EXCHANGE, 'topic', {
      durable: true,
    });

    this.logger.log('RabbitMQ topology configured');
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
        `Failed to close RabbitMQ channel: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      await connection?.close();
    } catch (error) {
      this.logger.warn(
        `Failed to close RabbitMQ connection: ${error instanceof Error ? error.message : String(error)}`,
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
}
