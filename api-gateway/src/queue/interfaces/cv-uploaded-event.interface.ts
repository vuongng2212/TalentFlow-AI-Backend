/**
 * Event published when a CV is uploaded.
 *
 * SECURITY NOTE: Do NOT include fileUrl in this event.
 * Consumers MUST use bucket + fileKey with S3 credentials to download files.
 * This prevents SSRF attacks.
 *
 * @see ADR-009 for message payload specification
 */
export interface CvUploadedEvent {
  candidateId: string;
  applicationId: string;
  jobId: string;
  bucket: string;
  fileKey: string;
  mimeType: string;
  uploadedAt: string;
}
