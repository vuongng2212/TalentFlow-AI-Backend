export const ROUTING_KEY = 'cv.parsed';

export interface CvParsedEvent {
  applicationId: string;
  recruiterId?: string;
  applicantId?: string;
  applicantEmail: string;
  applicantName: string;
  jobTitle: string;
  aiScore?: number;
  timestamp?: string;
}
