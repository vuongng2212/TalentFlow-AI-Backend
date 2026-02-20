export interface CvUploadedEvent {
  candidateId: string;
  applicationId: string;
  jobId: string;
  fileKey: string;
  fileUrl: string;
  mimeType: string;
  uploadedAt: string;
}
