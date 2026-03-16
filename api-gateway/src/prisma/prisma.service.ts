import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 10000;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.connectWithRetry();
  }

  private async connectWithRetry(): Promise<void> {
    const errors: string[] = [];

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Database connection established');
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Attempt ${attempt}: ${message}`);

        if (attempt === MAX_RETRIES) {
          this.logger.error(
            `Database connection failed after ${MAX_RETRIES} attempts. History: [${errors.join(' | ')}]`,
          );
          throw error;
        }

        const delayMs = this.calculateBackoff(attempt);
        this.logger.warn(
          `Database connection attempt ${attempt}/${MAX_RETRIES} failed: ${message}. Retrying in ${delayMs}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  private calculateBackoff(attempt: number): number {
    const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
    const capped = Math.min(exponentialDelay, MAX_DELAY_MS);
    const jitter = Math.floor(Math.random() * capped * 0.2);
    return capped + jitter;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
