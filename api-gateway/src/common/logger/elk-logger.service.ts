import { LoggerService, Injectable, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { ClsService } from 'nestjs-cls';

@Injectable({ scope: Scope.TRANSIENT })
export class ElkLoggerService implements LoggerService {
  private logger: winston.Logger;
  private context?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly cls: ClsService,
  ) {
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.printf(
            ({
              timestamp,
              level,
              message,
              context,
              correlationId,
              ...meta
            }) => {
              const contextStr =
                context && typeof context === 'string' ? `[${context}] ` : '';
              const corrStr =
                correlationId && typeof correlationId === 'string'
                  ? `[${correlationId}] `
                  : '';
              const metaStr = Object.keys(meta).length
                ? ` ${JSON.stringify(meta)}`
                : '';
              return `${String(timestamp)} ${String(level)}: ${corrStr}${contextStr}${String(message)}${metaStr}`;
            },
          ),
        ),
      }),
    ];

    const elkHost = this.configService.get<string>('ELK_HOST');
    if (elkHost) {
      const elkTransport = new ElasticsearchTransport({
        level: this.configService.get<string>('ELK_LOG_LEVEL', 'info'),
        clientOpts: {
          node: elkHost,
          auth: this.getElkAuth(),
        },
        indexPrefix: this.configService.get<string>(
          'ELK_INDEX_PREFIX',
          'talentflow-api',
        ),
        indexSuffixPattern: 'YYYY.MM.DD',
        buffering: true,
        bufferLimit: 100,
        flushInterval: 2000,
        transformer: (logData) => this.transformLog(logData),
      });

      elkTransport.on('error', (error) => {
        console.error('Elasticsearch transport error:', error);
      });

      transports.push(elkTransport);
    }

    this.logger = winston.createLogger({
      level: this.configService.get<string>('LOG_LEVEL', 'info'),
      defaultMeta: {
        service: 'api-gateway',
        environment: this.configService.get<string>('NODE_ENV', 'development'),
      },
      transports,
    });
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(message: unknown, context?: string): void {
    const correlationId = this.cls.getId();
    this.logger.info(this.formatMessage(message), {
      context: context || this.context,
      correlationId,
    });
  }

  error(message: unknown, trace?: string, context?: string): void {
    const correlationId = this.cls.getId();
    this.logger.error(this.formatMessage(message), {
      context: context || this.context,
      trace,
      correlationId,
    });
  }

  warn(message: unknown, context?: string): void {
    const correlationId = this.cls.getId();
    this.logger.warn(this.formatMessage(message), {
      context: context || this.context,
      correlationId,
    });
  }

  debug(message: unknown, context?: string): void {
    const correlationId = this.cls.getId();
    this.logger.debug(this.formatMessage(message), {
      context: context || this.context,
      correlationId,
    });
  }

  verbose(message: unknown, context?: string): void {
    const correlationId = this.cls.getId();
    this.logger.verbose(this.formatMessage(message), {
      context: context || this.context,
      correlationId,
    });
  }

  private formatMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }
    if (message instanceof Error) {
      return message.message;
    }
    return JSON.stringify(message);
  }

  private getElkAuth(): { username: string; password: string } | undefined {
    const username = this.configService.get<string>('ELK_USERNAME');
    const password = this.configService.get<string>('ELK_PASSWORD');

    if (username && password) {
      return { username, password };
    }
    return undefined;
  }

  private transformLog(logData: {
    message: string;
    level: string;
    meta: Record<string, unknown>;
    timestamp?: string;
  }): Record<string, unknown> {
    return {
      '@timestamp': logData.timestamp || new Date().toISOString(),
      message: logData.message,
      severity: logData.level,
      fields: {
        ...logData.meta,
      },
    };
  }
}
