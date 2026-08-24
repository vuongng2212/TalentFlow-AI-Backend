export const ROUTING_KEY = 'cv.failed';

export interface CvFailedEvent {
  applicationId: string;
  recruiterId?: string;
  applicantId?: string;
  applicantEmail: string;
  applicantName: string;
  jobTitle: string;
  errorMessage?: string;
  timestamp?: string;
}
