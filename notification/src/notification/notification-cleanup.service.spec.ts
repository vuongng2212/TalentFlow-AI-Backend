import { PrismaService } from '../prisma/prisma.service';
import { NotificationCleanupService } from './notification-cleanup.service';

describe('NotificationCleanupService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('permanently deletes notifications older than 30 days', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-10T12:00:00.000Z'));
    const prisma = {
      notification: {
        deleteMany: jest.fn().mockResolvedValue({ count: 7 }),
      },
    };
    const service = new NotificationCleanupService(
      prisma as unknown as PrismaService,
    );

    await expect(service.cleanupOldNotifications()).resolves.toBe(7);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: new Date('2026-08-11T12:00:00.000Z') },
      },
    });
  });
});
