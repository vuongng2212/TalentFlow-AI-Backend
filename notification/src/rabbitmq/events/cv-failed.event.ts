export const ROUTING_KEY = 'cv.failed';

export interface CvFailedEvent {
  applicationId: string;
  applicantEmail: string;
  applicantName: string;
  jobTitle: string;
  reason: string;
  failedAt: string;
}
