export interface RawCvParsedEvent {
  candidateId: string;
  applicationId: string;
  jobId: string;
  aiScore: number;
  parsedData: Record<string, unknown>;
  scoringReasoning: string;
  parsedAt: string;
}

export interface RawCvFailedEvent {
  candidateId: string;
  applicationId: string;
  jobId: string;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
  failedAt: string;
}

export interface EnrichedCvParsedEvent {
  applicationId: string;
  recruiterId: string;
  jobTitle: string;
  applicantEmail: string;
  applicantName: string;
  aiScore: number;
  timestamp: string;
}

export interface EnrichedCvFailedEvent {
  applicationId: string;
  recruiterId: string;
  jobTitle: string;
  applicantEmail: string;
  applicantName: string;
  errorMessage: string;
  timestamp: string;
}
