import {
  Injectable,
  Inject,
  forwardRef,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
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
  RawCvFailedEvent,
} from '../queue/interfaces/cv-events.interface';
import { UploadCvResponseDto } from './dto/upload-cv-response.dto';
import { IngestionResponseDto } from './dto/ingestion-response.dto';
import { sanitizeError } from '../common/utils/sanitize.util';
import { WorkspaceContextService } from '../common/services/workspace-context.service';
import { IngestionDto } from './dto/ingestion.dto';
import { CvOrchestrationService } from './cv-orchestration.service';
import { CvUploadService } from './cv-upload.service';

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
    private readonly cvOrchestrationService: CvOrchestrationService,
    private readonly cvUploadService: CvUploadService,
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
    return this.cvUploadService.createWithCv(userId, file, dto);
  }

  async ingestApplication(
    workspaceId: string,
    file: Express.Multer.File,
    dto: IngestionDto,
  ): Promise<IngestionResponseDto> {
    return this.cvUploadService.ingestApplication(workspaceId, file, dto);
  }

  async handleCvParsedEvent(event: RawCvParsedEvent): Promise<void> {
    return this.cvOrchestrationService.handleCvParsedEvent(event);
  }

  async handleCvFailedEvent(event: RawCvFailedEvent): Promise<void> {
    return this.cvOrchestrationService.handleCvFailedEvent(event);
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
    } else if (userRole !== 'ADMIN') {
      const candidateIdForViewer = await this.resolveCandidateIdForViewer(
        userId,
        workspaceId,
      );
      if (candidateIdForViewer) {
        where.candidateId = candidateIdForViewer;
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

  private async resolveCandidateIdForViewer(
    userId: string,
    workspaceId: string,
  ): Promise<string | undefined> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return undefined;
    }
    const candidate = await this.prisma.candidate.findUnique({
      where: {
        workspaceId_email: { workspaceId, email: user.email },
      },
    });
    return candidate?.id;
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
}
