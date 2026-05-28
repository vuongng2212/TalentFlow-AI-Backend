export const ROUTING_KEY = 'application.created';

export interface ApplicationCreatedEvent {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  applicantId: string;
  applicantEmail: string;
  applicantName: string;
  appliedAt: string;
}
