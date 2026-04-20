import { Injectable } from '@nestjs/common';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { NotificationEntity } from './entities/notification.entity';

@Injectable()
export class NotificationService {
  getNotificationById(id: string, userId: string): NotificationResponseDto {
    const notification: NotificationEntity = {
      id,
      userId,
      title: 'Sample notification',
      message: `Notification ${id} is available for ${userId}`,
      read: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    return {
      ...notification,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
