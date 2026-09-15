/**
 * Event published when an application is created.
 * Must match the payload structure expected by the notification service's ApplicationCreatedDto.
 */
export interface ApplicationCreatedEvent {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  applicantId: string;
  applicantEmail: string;
  applicantName: string;
  appliedAt: string;
}
