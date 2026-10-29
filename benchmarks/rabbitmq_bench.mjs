import amqp from '../api-gateway/node_modules/amqplib/channel_api.js';

const RABBIT_URL = 'amqp://rabbitmq:rabbitmq@localhost:5672';
const QUEUE_NAME = 'perf_benchmark_test_queue';
const MESSAGE_COUNT = 5000;
const BATCH_SIZE = 500;

async function run() {
  const connection = await amqp.connect(RABBIT_URL);
  const channel = await connection.createChannel();

  await channel.assertQueue(QUEUE_NAME, { durable: false, autoDelete: true });
  await channel.purgeQueue(QUEUE_NAME);

  const payload = Buffer.from(JSON.stringify({
    eventId: 'bench-12345',
    timestamp: Date.now(),
    type: 'BENCHMARK_EVENT',
    data: { candidateId: 'bfe26cf6-acb4-4061-aa14-f4b556e3aeb2', score: 95 }
  }));

  const pubStart = performance.now();
  for (let i = 0; i < MESSAGE_COUNT; i++) {
    channel.sendToQueue(QUEUE_NAME, payload, { persistent: false });
  }
  const pubEnd = performance.now();
  const pubDurationSec = (pubEnd - pubStart) / 1000;
  const pubRps = MESSAGE_COUNT / pubDurationSec;

  let consumedCount = 0;
  const latencies = [];
  const consumeStart = performance.now();

  await new Promise((resolve) => {
    channel.consume(QUEUE_NAME, (msg) => {
      if (!msg) return;
      const now = performance.now();
      const content = JSON.parse(msg.content.toString());
      latencies.push(now - consumeStart);
      channel.ack(msg);
      consumedCount++;
      if (consumedCount >= MESSAGE_COUNT) {
        resolve();
      }
    }, { noAck: false });
  });

  const consumeEnd = performance.now();
  const consumeDurationSec = (consumeEnd - consumeStart) / 1000;
  const consumeRps = MESSAGE_COUNT / consumeDurationSec;

  await channel.deleteQueue(QUEUE_NAME);
  await channel.close();
  await connection.close();

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  const result = {
    messageCount: MESSAGE_COUNT,
    publishDurationMs: (pubEnd - pubStart).toFixed(2),
    publishRps: pubRps.toFixed(2),
    consumeDurationMs: (consumeEnd - consumeStart).toFixed(2),
    consumeRps: consumeRps.toFixed(2),
    consumeLatencyP50Ms: p50.toFixed(2),
    consumeLatencyP95Ms: p95.toFixed(2),
    consumeLatencyP99Ms: p99.toFixed(2)
  };

  console.log(JSON.stringify(result, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
