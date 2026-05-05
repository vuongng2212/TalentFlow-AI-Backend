export class NotificationEntity {
  id: string;
  userId: string;
  type?: string;
  channel?: string;
  title: string;
  message: string;
  recipient?: string;
  subject?: string;
  status?: string;
  read: boolean;
  sentAt?: Date;
  createdAt: Date;
}
