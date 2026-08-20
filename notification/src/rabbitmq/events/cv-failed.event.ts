export const ROUTING_KEY = 'cv.failed';

export interface CvFailedEvent {
  applicationId: string;
  applicantId?: string;
  applicantEmail: string;
  applicantName: string;
  jobTitle: string;
  reason: string;
  failedAt: string;
}
