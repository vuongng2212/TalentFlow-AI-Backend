import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ChannelModel } from 'amqplib';
import * as amqplib from 'amqplib';

const RECONNECT_DELAY_MS = 5000;

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private connected = false;
  private shuttingDown = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private connectingPromise: Promise<void> | null = null;
  private setupCallbacks: Array<() => Promise<void>> = [];

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    void this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    this.clearReconnectTimer();
    await this.disposeCurrentResources();
  }

  isHealthy(): boolean {
    return this.connected && !!this.connection && !!this.channel;
  }

  getQueueName(): string {
    return (
      this.configService.get<string>('rabbitmq.queue') ?? 'notification_queue'
    );
  }

  getExchangeName(): string {
    return (
      this.configService.get<string>('rabbitmq.exchange') ?? 'talentflow.events'
    );
  }

  async getChannel(): Promise<Channel> {
    await this.ensureConnection();

    if (!this.channel) {
      throw new Error('RabbitMQ channel is not available');
    }

    return this.channel;
  }

  onReconnect(callback: () => Promise<void>): void {
    this.setupCallbacks.push(callback);
  }

  async ping(): Promise<void> {
    const isConnected = await this.ensureConnection();

    if (!isConnected || !this.channel) {
      throw new Error('RabbitMQ connection is not available');
    }

    try {
      await this.channel.checkQueue(this.getQueueName());
    } catch (error) {
      this.handleDisconnect('RabbitMQ channel health check failed');
      throw error;
    }
  }

  private async ensureConnection(): Promise<boolean> {
    if (this.isHealthy()) {
      return true;
    }

    await this.connect();
    return this.isHealthy();
  }

  private async connect(): Promise<void> {
    if (this.shuttingDown || this.isHealthy()) {
      return;
    }

    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.connectingPromise = this.openConnection();

    try {
      await this.connectingPromise;
    } finally {
      this.connectingPromise = null;
    }
  }

  private async openConnection(): Promise<void> {
    const url =
      this.configService.get<string>('rabbitmq.url') ??
      'amqp://guest:guest@localhost:5672';
    const queue = this.getQueueName();
    const exchange = this.getExchangeName();
    const prefetchCount =
      this.configService.get<number>('rabbitmq.prefetchCount') ?? 10;

    let connection: ChannelModel | null = null;
    let channel: Channel | null = null;

    try {
      const nextConnection = await amqplib.connect(url);
      const nextChannel = await nextConnection.createChannel();

      connection = nextConnection;
      channel = nextChannel;

      await nextChannel.assertExchange(exchange, 'topic', { durable: true });
      await nextChannel.assertQueue(queue, { durable: true });
      await nextChannel.prefetch(prefetchCount);

      nextConnection.on('close', () => {
        this.handleDisconnect('RabbitMQ connection closed');
      });
      nextConnection.on('error', (error: Error) => {
        if (this.shuttingDown) {
          return;
        }

        this.logger.error(`RabbitMQ connection error: ${error.message}`);
      });
      nextChannel.on('close', () => {
        this.handleDisconnect('RabbitMQ channel closed');
      });
      nextChannel.on('error', (error: Error) => {
        if (this.shuttingDown) {
          return;
        }

        this.logger.error(`RabbitMQ channel error: ${error.message}`);
      });

      this.connection = connection;
      this.channel = channel;
      this.connected = true;
      this.clearReconnectTimer();

      this.logger.log(
        `RabbitMQ connected to exchange "${exchange}" and queue "${queue}"`,
      );

      await this.invokeSetupCallbacks();
    } catch (error) {
      this.connected = false;
      this.connection = null;
      this.channel = null;

      await this.closeQuietly(channel);
      await this.closeQuietly(connection);

      this.logger.error(
        `Failed to connect to RabbitMQ: ${error instanceof Error ? error.message : String(error)}`,
      );

      this.scheduleReconnect();
    }
  }

  private handleDisconnect(message: string): void {
    if (this.shuttingDown) {
      return;
    }

    const wasConnected = this.connected;

    this.connected = false;
    this.connection = null;
    this.channel = null;

    if (wasConnected) {
      this.logger.warn(message);
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.shuttingDown || this.reconnectTimeout) {
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      void this.connect();
    }, RECONNECT_DELAY_MS);
  }

  private async invokeSetupCallbacks(): Promise<void> {
    for (const callback of this.setupCallbacks) {
      try {
        await callback();
      } catch (error) {
        this.logger.error(
          `Setup callback failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimeout) {
      return;
    }

    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
  }

  private async disposeCurrentResources(): Promise<void> {
    const channel = this.channel;
    const connection = this.connection;

    this.connected = false;
    this.channel = null;
    this.connection = null;

    await this.closeQuietly(channel);
    await this.closeQuietly(connection);
  }

  private async closeQuietly(
    resource: { close: () => Promise<void> } | null,
  ): Promise<void> {
    if (!resource) {
      return;
    }

    try {
      await resource.close();
    } catch {
      // Ignore close failures during reconnect/shutdown cleanup.
    }
  }
}
