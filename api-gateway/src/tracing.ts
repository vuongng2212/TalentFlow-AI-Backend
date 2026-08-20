/**
 * OpenTelemetry tracing bootstrap for API Gateway.
 *
 * IMPORTANT: This file MUST be imported/required BEFORE any other module,
 * including NestJS and all instrumented libraries (http, express, etc.).
 *
 * Usage in main.ts:
 *   import './tracing';   // must be the very first import
 *
 * Environment variables:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  — Jaeger/Collector OTLP endpoint (default: http://localhost:4318)
 *   OTEL_SERVICE_NAME            — override service name (default: api-gateway)
 *   OTEL_ENABLED                 — set to 'false' to disable tracing (default: true)
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

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
        process.env.OTEL_SERVICE_NAME ?? 'api-gateway',
      [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.1',
      environment: process.env.NODE_ENV ?? 'development',
    }),
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy fs instrumentation
        '@opentelemetry/instrumentation-fs': { enabled: false },
        // HTTP instrumentation — captures all inbound/outbound HTTP spans
        '@opentelemetry/instrumentation-http': { enabled: true },
        // Express instrumentation — route-level spans
        '@opentelemetry/instrumentation-express': { enabled: true },
        // NestJS instrumentation
        '@opentelemetry/instrumentation-nestjs-core': { enabled: true },
      }),
    ],
  });

  sdk.start();

  // Graceful shutdown — flush remaining spans on SIGTERM
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
    `[OTel] Tracing enabled — exporting to ${otlpEndpoint} (service: api-gateway)`,
  );
} else {
  console.log('[OTel] Tracing disabled (OTEL_ENABLED=false)');
}
