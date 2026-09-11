import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '@prisma/client';
import { EmailService } from '../email/email.service';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';

describe('NotificationService history', () => {
  let service: NotificationService;
  let prisma: {
    notification: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  const storedNotification = {
    id: 'notification-1',
    userId: 'user-1',
    type: NotificationType.APPLICATION_UPDATE,
    channel: NotificationChannel.EMAIL,
    title: 'Application updated',
    message: 'Your application has been reviewed.',
    subject: 'Application updated',
    recipient: 'candidate@example.com',
    templateId: null,
    templateData: null,
    metadata: null,
    externalId: null,
    status: NotificationStatus.SENT,
    isRead: false,
    readAt: null,
    sentAt: new Date('2026-09-10T08:00:00.000Z'),
    failedAt: null,
    errorMessage: null,
    expiresAt: null,
    createdAt: new Date('2026-09-10T07:59:00.000Z'),
    updatedAt: new Date('2026-09-10T08:00:00.000Z'),
    deletedAt: null,
  };

  beforeEach(() => {
    prisma = {
      notification: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new NotificationService(
      { sendEmail: jest.fn() } as unknown as EmailService,
      { sendToUser: jest.fn() } as unknown as NotificationGateway,
      prisma as unknown as PrismaService,
      {
        recordNotificationSent: jest.fn(),
        recordDeliveryDuration: jest.fn(),
      } as unknown as MetricsService,
    );
  });

  it('returns one page of active notifications ordered newest first', async () => {
    prisma.notification.findMany.mockResolvedValue([storedNotification]);
    prisma.notification.count.mockResolvedValue(21);

    const result = await service.getByUserId('user-1', 2, 10);

    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: 'notification-1',
          userId: 'user-1',
          type: 'application_update',
          channel: 'email',
          status: 'sent',
          read: false,
          isRead: false,
        }),
      ],
      pagination: {
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
      },
    });
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      skip: 10,
      take: 10,
    });
  });

  it('returns an active notification by id', async () => {
    prisma.notification.findFirst.mockResolvedValue(storedNotification);

    const result = await service.getById('notification-1');

    expect(result).toEqual(
      expect.objectContaining({ id: 'notification-1', userId: 'user-1' }),
    );
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: { id: 'notification-1', deletedAt: null },
    });
  });

  it('returns null when an active notification does not exist', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(service.getById('missing')).resolves.toBeNull();
  });

  it('counts only unread active notifications owned by the user', async () => {
    prisma.notification.count.mockResolvedValue(4);

    await expect(service.getUnreadCount('user-1')).resolves.toBe(4);
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', isRead: false, deletedAt: null },
    });
  });

  it('marks a notification as read with a timestamp', async () => {
    prisma.notification.update.mockImplementation(
      ({ data }: { data: { isRead: boolean; readAt: Date; status: string } }) =>
        Promise.resolve({ ...storedNotification, ...data }),
    );

    const result = await service.markAsRead('notification-1');

    expect(result.isRead).toBe(true);
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-1' },
      data: {
        isRead: true,
        readAt: expect.any(Date) as Date,
        status: NotificationStatus.READ,
      },
    });
  });

  it('soft deletes a notification', async () => {
    prisma.notification.update.mockResolvedValue(storedNotification);

    await service.delete('notification-1');

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-1' },
      data: { deletedAt: expect.any(Date) as Date },
    });
  });
});
