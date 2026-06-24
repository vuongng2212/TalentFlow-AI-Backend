/**
 * OpenTelemetry tracing bootstrap for Notification service.
 *
 * IMPORTANT: This file MUST be imported BEFORE any other module.
 *
 * Environment variables:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  — default: http://localhost:4318
 *   OTEL_SERVICE_NAME            — default: notification-service
 *   OTEL_ENABLED                 — set 'false' to disable
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const enabled = process.env.OTEL_ENABLED !== 'false';

if (enabled) {
  const otlpEndpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

  const exporter = new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]:
        process.env.OTEL_SERVICE_NAME ?? 'notification-service',
      [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.1',
      environment: process.env.NODE_ENV ?? 'development',
    }),
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-nestjs-core': { enabled: true },
        // Track RabbitMQ AMQP calls
        '@opentelemetry/instrumentation-amqplib': { enabled: true },
      }),
    ],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('[OTel] Tracing shut down gracefully'))
      .catch((err: Error) =>
        console.error('[OTel] Error shutting down tracing', err),
      )
      .finally(() => process.exit(0));
  });

  console.log(
    `[OTel] Tracing enabled — exporting to ${otlpEndpoint} (service: notification-service)`,
  );
} else {
  console.log('[OTel] Tracing disabled (OTEL_ENABLED=false)');
}
