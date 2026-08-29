import {
  Injectable,
  Inject,
  forwardRef,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { QueueService } from '../queue/queue.service';
import { WorkspaceContextService } from '../common/services/workspace-context.service';
import { UploadCvDto } from './dto/upload-cv.dto';
import { UploadCvResponseDto } from './dto/upload-cv-response.dto';
import { IngestionDto } from './dto/ingestion.dto';
import { IngestionResponseDto } from './dto/ingestion-response.dto';
import { generateCvFileKey } from '../common/utils/file-key.util';
import { sanitizeError } from '../common/utils/sanitize.util';
import { CvParsingStatus } from '@prisma/client';

@Injectable()
export class CvUploadService {
  private readonly logger = new Logger(CvUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
    private readonly workspaceContext: WorkspaceContextService,
  ) {}

  async createWithCv(
    userId: string,
    file: Express.Multer.File,
    dto: UploadCvDto,
  ): Promise<UploadCvResponseDto> {
    const { jobId, coverLetter } = dto;
    const workspaceId = this.workspaceContext.getWorkspaceId();

    const job = await this.findOpenJobOrThrow(jobId, workspaceId);
    const candidate = await this.findOrCreateCandidateForUser(
      userId,
      workspaceId,
    );
    await this.ensureNoDuplicateApplication(jobId, candidate.id);

    const { application, fileKey, uploadUrl } = await this.processCvUpload({
      workspaceId,
      job,
      candidate,
      file,
      coverLetter,
      actionName: 'upload',
    });

    return this.buildUploadResponse(application.id, fileKey, uploadUrl);
  }

  async ingestApplication(
    workspaceId: string,
    file: Express.Multer.File,
    dto: IngestionDto,
  ): Promise<IngestionResponseDto> {
    const {
      jobId,
      candidateEmail,
      candidateName,
      coverLetter,
      externalMessageId,
    } = dto;

    if (externalMessageId) {
      const existingByMessageId = await this.prisma.application.findFirst({
        where: { externalMessageId, workspaceId, deletedAt: null },
      });

      if (existingByMessageId) {
        this.logger.warn(
          `Duplicate ingestion blocked: externalMessageId=${externalMessageId} already processed`,
        );
        throw new ConflictException('This email has already been processed');
      }
    }

    const job = await this.findOpenJobOrThrow(jobId, workspaceId);
    const candidate = await this.findOrCreateCandidateForEmail(
      workspaceId,
      candidateEmail,
      candidateName,
    );
    await this.ensureNoDuplicateApplication(jobId, candidate.id);

    const { application } = await this.processCvUpload({
      workspaceId,
      job,
      candidate,
      file,
      coverLetter,
      externalMessageId,
      cvParsingStatus: CvParsingStatus.PENDING,
      actionName: 'ingestion',
    });

    return {
      success: true,
      data: {
        applicationId: application.id,
        candidateId: candidate.id,
        status: 'processing',
        message: 'CV ingestion initiated successfully.',
      },
    };
  }

  private async findOpenJobOrThrow(jobId: string, workspaceId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, workspaceId },
    });

    if (!job || job.deletedAt) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    if (job.status !== 'OPEN') {
      throw new ForbiddenException('Cannot apply to a job that is not open');
    }

    return job;
  }

  private async findOrCreateCandidateForUser(
    userId: string,
    workspaceId: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const candidate = await this.prisma.candidate.findUnique({
      where: {
        workspaceId_email: { workspaceId, email: user.email },
      },
    });

    if (candidate) {
      return candidate;
    }

    return this.prisma.candidate.create({
      data: {
        email: user.email,
        fullName: user.fullName,
        workspaceId,
      },
    });
  }

  private async findOrCreateCandidateForEmail(
    workspaceId: string,
    email: string,
    fullName: string,
  ) {
    const candidate = await this.prisma.candidate.findUnique({
      where: {
        workspaceId_email: { workspaceId, email },
      },
    });

    if (candidate) {
      return candidate;
    }

    return this.prisma.candidate.create({
      data: {
        email,
        fullName,
        workspaceId,
      },
    });
  }

  private async ensureNoDuplicateApplication(
    jobId: string,
    candidateId: string,
  ): Promise<void> {
    const existingApplication = await this.prisma.application.findFirst({
      where: {
        jobId,
        candidateId,
        deletedAt: null,
      },
    });

    if (existingApplication) {
      throw new ConflictException('You have already applied to this job');
    }
  }

  private async uploadCvOrThrow(
    file: Express.Multer.File,
  ): Promise<{ fileKey: string; uploadUrl: string }> {
    const originalname = file.originalname;
    const fileKey = generateCvFileKey(originalname);

    try {
      const uploadResult = await this.storageService.upload(
        file.buffer,
        fileKey,
        file.mimetype,
      );

      return {
        fileKey,
        uploadUrl: uploadResult.url,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload CV file ${fileKey}`,
        sanitizeError(error),
      );
      throw new InternalServerErrorException('Failed to upload CV file');
    }
  }

  private async buildUploadResponse(
    applicationId: string,
    fileKey: string,
    uploadUrl: string,
  ): Promise<UploadCvResponseDto> {
    let presignedUrl: string | undefined;

    try {
      presignedUrl = await this.storageService.getSignedUrl(fileKey);
    } catch (error) {
      this.logger.warn(
        `Failed to generate presigned URL for file ${fileKey}`,
        sanitizeError(error),
      );
      presignedUrl = undefined;
    }

    return {
      applicationId,
      fileKey,
      fileUrl: uploadUrl,
      presignedUrl,
      status: 'processing',
      message: 'CV uploaded successfully. Processing started.',
    };
  }

  private async rollbackCvUpload(
    applicationId: string | null,
    fileKey: string,
  ): Promise<void> {
    if (applicationId) {
      try {
        await this.prisma.application.delete({
          where: { id: applicationId },
        });
      } catch (error) {
        this.logger.error(
          `Failed to rollback application ${applicationId}`,
          sanitizeError(error),
        );
      }
    }

    try {
      await this.storageService.delete(fileKey);
    } catch (error) {
      this.logger.error(
        `Failed to rollback uploaded file ${fileKey}`,
        sanitizeError(error),
      );
    }
  }

  private async processCvUpload(params: {
    workspaceId: string;
    job: { id: string; title: string };
    candidate: { id: string; email: string; fullName: string };
    file: Express.Multer.File;
    coverLetter?: string;
    externalMessageId?: string;
    cvParsingStatus?: CvParsingStatus;
    actionName: 'upload' | 'ingestion';
  }) {
    const { fileKey, uploadUrl } = await this.uploadCvOrThrow(params.file);

    let applicationId: string | null = null;

    try {
      const application = await this.prisma.application.create({
        data: {
          jobId: params.job.id,
          candidateId: params.candidate.id,
          workspaceId: params.workspaceId,
          coverLetter: params.coverLetter,
          cvFileKey: fileKey,
          cvFileUrl: uploadUrl,
          ...(params.cvParsingStatus
            ? { cvParsingStatus: params.cvParsingStatus }
            : {}),
          externalMessageId: params.externalMessageId,
        },
      });

      applicationId = application.id;

      await this.queueService.publishCvUploaded({
        candidateId: params.candidate.id,
        applicationId: application.id,
        jobId: params.job.id,
        bucket: this.storageService.getBucketName(),
        fileKey,
        mimeType: params.file.mimetype,
        uploadedAt: new Date().toISOString(),
      });

      await this.queueService.publishApplicationCreated({
        applicationId: application.id,
        jobId: params.job.id,
        jobTitle: params.job.title,
        applicantId: params.candidate.id,
        applicantEmail: params.candidate.email,
        applicantName: params.candidate.fullName,
        appliedAt: application.appliedAt.toISOString(),
      });

      return { application, fileKey, uploadUrl };
    } catch (error) {
      this.logger.error(
        `Failed to process ${params.actionName === 'upload' ? 'CV upload' : 'ingestion'} for job ${params.job.id}, candidate ${params.candidate.id}, file ${fileKey}`,
        sanitizeError(error),
      );
      await this.rollbackCvUpload(applicationId, fileKey);
      throw new InternalServerErrorException(
        `Failed to process ${params.actionName === 'ingestion' ? 'CV ingestion' : 'CV upload'}`,
      );
    }
  }
}
