export const ROUTING_KEY = 'cv.parsed';

export interface CvParsedEvent {
  applicationId: string;
  applicantEmail: string;
  applicantName: string;
  jobTitle: string;
  score?: number;
  parsedAt: string;
}
