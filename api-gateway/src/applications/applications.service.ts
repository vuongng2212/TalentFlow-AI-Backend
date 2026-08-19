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
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { QueryApplicationsDto } from './dto/query-applications.dto';
import {
  Prisma,
  ApplicationStatus,
  ApplicationStage,
  CvParsingStatus,
} from '@prisma/client';
import { StorageService } from '../storage/storage.service';
import { QueueService } from '../queue/queue.service';
import { UploadCvDto } from './dto/upload-cv.dto';
import {
  RawCvParsedEvent,
  EnrichedCvParsedEvent,
  RawCvFailedEvent,
  EnrichedCvFailedEvent,
} from '../queue/interfaces/cv-events.interface';
import { UploadCvResponseDto } from './dto/upload-cv-response.dto';
import { IngestionResponseDto } from './dto/ingestion-response.dto';
import { generateCvFileKey } from '../common/utils/file-key.util';
import { sanitizeError } from '../common/utils/sanitize.util';
import { WorkspaceContextService } from '../common/services/workspace-context.service';
import { IngestionDto } from './dto/ingestion.dto';

interface ApplicationWithRelations {
  id: string;
  jobId: string;
  candidateId: string;
  workspaceId: string;
  stage: ApplicationStage;
  status: ApplicationStatus;
  cvFileKey: string | null;
  cvFileUrl: string | null;
  coverLetter: string | null;
  notes: string | null;
  cvParsingStatus: CvParsingStatus;
  aiScore: number | null;
  scoringReasoning: string | null;
  parsedData: Prisma.JsonValue | null;
  appliedAt: Date;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  job: {
    id: string;
    title: string;
    department: string | null;
    location?: string | null;
    employmentType?: string | null;
    createdById: string;
    createdBy?: {
      id: string;
      email: string;
      fullName: string;
    };
  };
  candidate: {
    id: string;
    email: string;
    fullName: string;
  };
}

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
    private readonly workspaceContext: WorkspaceContextService,
  ) {}

  async create(
    userId: string,
    createApplicationDto: CreateApplicationDto,
  ): Promise<ApplicationWithRelations> {
    const { jobId, ...data } = createApplicationDto;

    const workspaceId = this.workspaceContext.getWorkspaceId();
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, workspaceId },
    });

    if (!job || job.deletedAt) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    if (job.status !== 'OPEN') {
      throw new ForbiddenException('Cannot apply to a job that is not open');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let candidate = await this.prisma.candidate.findUnique({
      where: {
        workspaceId_email: { workspaceId, email: user.email },
      },
    });

    if (!candidate) {
      candidate = await this.prisma.candidate.create({
        data: {
          email: user.email,
          fullName: user.fullName,
          workspaceId,
        },
      });
    }

    const existingApplication = await this.prisma.application.findFirst({
      where: {
        jobId,
        candidateId: candidate.id,
        deletedAt: null,
      },
    });

    if (existingApplication) {
      throw new ConflictException('You have already applied to this job');
    }

    const application = await this.prisma.application.create({
      data: {
        ...data,
        jobId,
        candidateId: candidate.id,
        workspaceId,
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            department: true,
            createdById: true,
          },
        },
        candidate: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    try {
      await this.queueService.publishApplicationCreated({
        applicationId: application.id,
        jobId: application.jobId,
        jobTitle: application.job.title,
        applicantId: application.candidateId,
        applicantEmail: application.candidate.email,
        applicantName: application.candidate.fullName,
        appliedAt: application.appliedAt.toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish application.created event for application ${application.id}`,
        sanitizeError(error),
      );
    }

    return application;
  }

  async createWithCv(
    userId: string,
    file: Express.Multer.File,
    dto: UploadCvDto,
  ): Promise<UploadCvResponseDto> {
    const { jobId, coverLetter } = dto;
    const workspaceId = this.workspaceContext.getWorkspaceId();

    const job = await this.findOpenJobOrThrow(jobId, workspaceId);
    const candidate = await this.findOrCreateCandidateOrThrow(
      userId,
      workspaceId,
    );
    await this.ensureNoDuplicateApplication(jobId, candidate.id);

    const { fileKey, uploadUrl } = await this.uploadCvOrThrow(file);

    let applicationId: string | null = null;

    try {
      const application = await this.prisma.application.create({
        data: {
          jobId,
          candidateId: candidate.id,
          workspaceId,
          coverLetter,
          cvFileKey: fileKey,
          cvFileUrl: uploadUrl,
        },
      });

      applicationId = application.id;

      await this.queueService.publishCvUploaded({
        candidateId: candidate.id,
        applicationId: application.id,
        jobId,
        bucket: this.storageService.getBucketName(),
        fileKey,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString(),
      });

      await this.queueService.publishApplicationCreated({
        applicationId: application.id,
        jobId,
        jobTitle: job.title,
        applicantId: candidate.id,
        applicantEmail: candidate.email,
        applicantName: candidate.fullName,
        appliedAt: application.appliedAt.toISOString(),
      });

      return this.buildUploadResponse(application.id, fileKey, uploadUrl);
    } catch (error) {
      this.logger.error(
        `Failed to process CV upload for job ${jobId}, candidate ${candidate.id}, file ${fileKey}`,
        sanitizeError(error),
      );
      await this.rollbackCreateWithCv(applicationId, fileKey);
      throw new InternalServerErrorException('Failed to process CV upload');
    }
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

  private async findOrCreateCandidateOrThrow(
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

  private async rollbackCreateWithCv(
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

  async findAll(userId: string, userRole: string, query: QueryApplicationsDto) {
    const workspaceId = this.workspaceContext.getWorkspaceId();
    const {
      page = 1,
      limit = 10,
      jobId,
      candidateId,
      stage,
      status,
      sortBy = 'appliedAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ApplicationWhereInput = {
      workspaceId,
      deletedAt: null,
    };

    if (userRole === 'RECRUITER') {
      where.job = {
        workspaceId,
        createdById: userId,
      };
    } else if (userRole === 'INTERVIEWER') {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const candidate = await this.prisma.candidate.findUnique({
          where: {
            workspaceId_email: { workspaceId, email: user.email },
          },
        });
        if (candidate) {
          where.candidateId = candidate.id;
        }
      }
    } else if (userRole !== 'ADMIN') {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const candidate = await this.prisma.candidate.findUnique({
          where: {
            workspaceId_email: { workspaceId, email: user.email },
          },
        });
        if (candidate) {
          where.candidateId = candidate.id;
        }
      }
    }

    if (jobId) {
      where.jobId = jobId;
    }

    if (candidateId && userRole === 'ADMIN') {
      where.candidateId = candidateId;
    }

    if (stage) {
      where.stage = stage;
    }

    if (status) {
      where.status = status;
    }

    const [applications, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy as string]: sortOrder,
        },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              department: true,
              location: true,
              employmentType: true,
            },
          },
          candidate: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      data: applications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    id: string,
    userId: string,
    userRole: string,
  ): Promise<ApplicationWithRelations> {
    const workspaceId = this.workspaceContext.getWorkspaceId();
    const application = await this.prisma.application.findFirst({
      where: { id, workspaceId },
      include: {
        job: {
          include: {
            createdBy: {
              select: {
                id: true,
                email: true,
                fullName: true,
              },
            },
          },
        },
        candidate: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!application || application.deletedAt) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const candidate = user
      ? await this.prisma.candidate.findUnique({
          where: {
            workspaceId_email: { workspaceId, email: user.email },
          },
        })
      : null;

    const isApplicant = candidate && application.candidateId === candidate.id;
    const isRecruiter = application.job.createdById === userId;
    const isAdmin = userRole === 'ADMIN';

    if (!isApplicant && !isRecruiter && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to view this application',
      );
    }

    return application;
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    updateApplicationDto: UpdateApplicationDto,
  ): Promise<ApplicationWithRelations> {
    const application = await this.findOne(id, userId, userRole);
    const workspaceId = this.workspaceContext.getWorkspaceId();

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const candidate = user
      ? await this.prisma.candidate.findUnique({
          where: {
            workspaceId_email: { workspaceId, email: user.email },
          },
        })
      : null;

    const isRecruiter = application.job.createdById === userId;
    const isApplicant = candidate && application.candidateId === candidate.id;
    const isAdmin = userRole === 'ADMIN';

    if (
      updateApplicationDto.stage ||
      updateApplicationDto.status ||
      updateApplicationDto.notes
    ) {
      if (!isRecruiter && !isAdmin) {
        throw new ForbiddenException(
          'Only recruiters can update application stage, status and notes',
        );
      }
    }

    if (!isRecruiter && !isAdmin && !isApplicant) {
      throw new ForbiddenException(
        'You do not have permission to update this application',
      );
    }

    const updateData: Partial<UpdateApplicationDto> & { reviewedAt?: Date } = {
      ...updateApplicationDto,
    };

    if (
      updateApplicationDto.status &&
      application.status !== updateApplicationDto.status
    ) {
      updateData.reviewedAt = new Date();
    }

    return this.prisma.application.update({
      where: { id },
      data: updateData,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            department: true,
            createdById: true,
          },
        },
        candidate: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });
  }

  async remove(id: string, userId: string, userRole: string): Promise<void> {
    const application = await this.findOne(id, userId, userRole);

    const workspaceId = this.workspaceContext.getWorkspaceId();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const candidate = user
      ? await this.prisma.candidate.findUnique({
          where: {
            workspaceId_email: { workspaceId, email: user.email },
          },
        })
      : null;

    const isApplicant = candidate && application.candidateId === candidate.id;
    const isAdmin = userRole === 'ADMIN';

    if (!isApplicant && !isAdmin) {
      throw new ForbiddenException(
        'Only applicants can withdraw their applications',
      );
    }

    await this.prisma.application.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'WITHDRAWN',
      },
    });
  }

  async handleCvParsedEvent(event: RawCvParsedEvent): Promise<void> {
    const { applicationId, aiScore, parsedData, scoringReasoning } = event;

    this.logger.log(
      `Handling cv.parsed event for application ${applicationId}`,
    );

    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            createdById: true,
            createdBy: {
              select: { email: true },
            },
          },
        },
        candidate: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    if (!application) {
      this.logger.warn(
        `Application ${applicationId} not found for cv.parsed event`,
      );
      return;
    }

    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        cvParsingStatus: CvParsingStatus.COMPLETED,
        aiScore,
        scoringReasoning,
        parsedData: parsedData as Prisma.InputJsonValue,
      },
    });

    if (!(application.job.createdBy as { email?: string } | undefined)?.email) {
      const recruiterUser = await this.prisma.user.findUnique({
        where: { id: application.job.createdById },
      });
      if (recruiterUser && application.job.createdBy) {
        application.job.createdBy.email = recruiterUser.email;
      }
    }

    if (!(application.job.createdBy as { email?: string } | undefined)?.email) {
      this.logger.warn(
        `Could not find recruiter email for job ${application.job.id}, skipping success notification.`,
      );
      return;
    }

    const enrichedEvent: EnrichedCvParsedEvent = {
      applicationId,
      recruiterId: application.job.createdById,
      jobTitle: application.job.title,
      applicantEmail: application.candidate.email,
      applicantName: application.candidate.fullName,
      aiScore: aiScore || 0,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.queueService.publishEnrichedCvParsed(enrichedEvent);
    } catch (error) {
      this.logger.error(
        `Failed to publish enriched cv.parsed event for application ${applicationId}`,
        sanitizeError(error),
      );
    }
  }

  async handleCvFailedEvent(event: RawCvFailedEvent): Promise<void> {
    const { applicationId, errorMessage } = event;

    this.logger.log(
      `Handling cv.failed event for application ${applicationId}`,
    );

    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            createdById: true,
            createdBy: {
              select: { email: true },
            },
          },
        },
        candidate: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    if (!application) {
      this.logger.warn(
        `Application ${applicationId} not found for cv.failed event`,
      );
      return;
    }

    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        cvParsingStatus: CvParsingStatus.FAILED,
      },
    });

    if (!(application.job.createdBy as { email?: string } | undefined)?.email) {
      const recruiterUser = await this.prisma.user.findUnique({
        where: { id: application.job.createdById },
      });
      if (recruiterUser && application.job.createdBy) {
        application.job.createdBy.email = recruiterUser.email;
      }
    }

    if (!(application.job.createdBy as { email?: string } | undefined)?.email) {
      this.logger.warn(
        `Could not find recruiter email for job ${application.job.id}, skipping failure notification.`,
      );
      return;
    }

    const enrichedEvent: EnrichedCvFailedEvent = {
      applicationId,
      recruiterId: application.job.createdById,
      jobTitle: application.job.title,
      applicantEmail: application.candidate.email,
      applicantName: application.candidate.fullName,
      errorMessage: errorMessage,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.queueService.publishEnrichedCvFailed(enrichedEvent);
    } catch (error) {
      this.logger.error(
        `Failed to publish enriched cv.failed event for application ${applicationId}`,
        sanitizeError(error),
      );
    }
  }

  /**
   * Ingest an application from n8n email ingestion webhook (Phase 1).
   * Protected by ApiKeyGuard, receives workspaceId from x-workspace-id header.
   */
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

    // 1. Technical idempotency: block duplicate webhook retries.
    // Scoped to the workspace to avoid cross-tenant message-ID collisions
    // blocking legitimate ingestions (cross-tenant denial of service).
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

    // 2. Verify the job exists and is open in the specified workspace
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, workspaceId },
    });

    if (!job || job.deletedAt) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    if (job.status !== 'OPEN') {
      throw new ForbiddenException('Cannot apply to a job that is not open');
    }

    // 3. Find or create candidate in that workspace
    let candidate = await this.prisma.candidate.findUnique({
      where: {
        workspaceId_email: { workspaceId, email: candidateEmail },
      },
    });

    if (!candidate) {
      candidate = await this.prisma.candidate.create({
        data: {
          email: candidateEmail,
          fullName: candidateName,
          workspaceId,
        },
      });
    }

    // 4. Business deduplication: prevent duplicate applications per job+candidate
    const existingApplication = await this.prisma.application.findFirst({
      where: {
        jobId,
        candidateId: candidate.id,
        deletedAt: null,
      },
    });

    if (existingApplication) {
      throw new ConflictException('You have already applied to this job');
    }

    // 5. Upload CV to storage
    const fileKey = generateCvFileKey(file.originalname);

    let uploadUrl: string;
    try {
      const uploadResult = await this.storageService.upload(
        file.buffer,
        fileKey,
        file.mimetype,
      );
      uploadUrl = uploadResult.url;
    } catch (error) {
      this.logger.error(
        `Failed to upload CV file ${fileKey}`,
        sanitizeError(error),
      );
      throw new InternalServerErrorException('Failed to upload CV file');
    }

    // 6. Create application in DB
    let applicationId: string | null = null;

    try {
      const application = await this.prisma.application.create({
        data: {
          jobId,
          candidateId: candidate.id,
          workspaceId,
          coverLetter,
          cvFileKey: fileKey,
          cvFileUrl: uploadUrl,
          cvParsingStatus: 'PENDING',
          externalMessageId,
        },
      });

      applicationId = application.id;

      // 7. Publish events to trigger CV parsing pipeline
      await this.queueService.publishCvUploaded({
        candidateId: candidate.id,
        applicationId: application.id,
        jobId,
        bucket: this.storageService.getBucketName(),
        fileKey,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString(),
      });

      await this.queueService.publishApplicationCreated({
        applicationId: application.id,
        jobId,
        jobTitle: job.title,
        applicantId: candidate.id,
        applicantEmail: candidate.email,
        applicantName: candidate.fullName,
        appliedAt: application.appliedAt.toISOString(),
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
    } catch (error) {
      this.logger.error(
        `Failed to process ingestion for job ${jobId}, candidate ${candidate.id}, file ${fileKey}`,
        sanitizeError(error),
      );
      // Rollback: delete the DB record then the uploaded file
      if (applicationId) {
        try {
          await this.prisma.application.delete({
            where: { id: applicationId },
          });
        } catch (rollbackError) {
          this.logger.error(
            `Failed to rollback application ${applicationId}`,
            sanitizeError(rollbackError),
          );
        }
      }
      try {
        await this.storageService.delete(fileKey);
      } catch (rollbackError) {
        this.logger.error(
          `Failed to rollback uploaded file ${fileKey}`,
          sanitizeError(rollbackError),
        );
      }
      throw new InternalServerErrorException('Failed to process CV ingestion');
    }
  }
}
