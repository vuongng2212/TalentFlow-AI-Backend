export class NotificationEntity {
  id: string;
  userId: string;
  /** Present on CV-result notifications so the frontend can target the application to refresh. */
  applicationId?: string;
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
