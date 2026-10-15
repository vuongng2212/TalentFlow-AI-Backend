import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const RETENTION_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class NotificationCleanupService {
  private readonly logger = new Logger(NotificationCleanupService.name);

  constructor(private readonly prismaService: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldNotifications(): Promise<number> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * MILLISECONDS_PER_DAY);
    const result = await this.prismaService.notification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    this.logger.log(
      `Notification retention cleanup removed ${result.count} records`,
    );
    return result.count;
  }
}
