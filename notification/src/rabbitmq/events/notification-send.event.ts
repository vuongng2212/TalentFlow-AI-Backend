export const ROUTING_KEY = 'notification.send';

export interface NotificationSendEvent {
  userId: string;
  to: string;
  subject: string;
  body?: string;
  type:
    | 'email'
    | 'application_confirmation'
    | 'interview_invitation'
    | 'new_application_hr'
    | 'application_result';
  templateId?: string;
  templateData?: Record<string, unknown>;
}
