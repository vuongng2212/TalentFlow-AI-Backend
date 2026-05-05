import { registerAs } from '@nestjs/config';

export const rabbitmqConfig = registerAs('rabbitmq', () => ({
  url: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
  queue: process.env.RABBITMQ_QUEUE ?? 'notification_queue',
  exchange: process.env.RABBITMQ_EXCHANGE ?? 'talentflow.events',
  prefetchCount: Number(process.env.RABBITMQ_PREFETCH_COUNT ?? 10),
}));

export type RabbitmqConfig = ReturnType<typeof rabbitmqConfig>;
