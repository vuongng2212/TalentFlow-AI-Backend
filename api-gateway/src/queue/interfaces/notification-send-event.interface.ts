/**
 * Types of notifications supported by the notification service.
 * Must match the NotificationType enum in the notification service.
 */
export enum NotificationType {
  EMAIL = 'email',
  APPLICATION_CONFIRMATION = 'application_confirmation',
  INTERVIEW_INVITATION = 'interview_invitation',
  NEW_APPLICATION_HR = 'new_application_hr',
  APPLICATION_RESULT = 'application_result',
}

/**
 * Event published to request sending a direct notification.
 * Must match the payload structure expected by the notification service's NotificationSendDto.
 */
export interface NotificationSendEvent {
  userId: string;
  to: string;
  subject: string;
  body?: string;
  type: NotificationType;
  templateId?: string;
  templateData?: Record<string, unknown>;
}
