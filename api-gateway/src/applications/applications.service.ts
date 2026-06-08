import {
  Injectable,
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
  WorkspaceMemberStatus,
  WorkspaceMemberRole,
} from '@prisma/client';
import { StorageService } from '../storage/storage.service';
import { QueueService } from '../queue/queue.service';
import { UploadCvDto } from './dto/upload-cv.dto';
import { UploadCvResponseDto } from './dto/upload-cv-response.dto';
import { generateCvFileKey } from '../common/utils/file-key.util';
import { sanitizeError } from '../common/utils/sanitize.util';
import { WorkspaceContextService } from '../common/services/workspace-context.service';

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
    private readonly queueService: QueueService,
    private readonly workspaceContext: WorkspaceContextService,
  ) {}

  async create(
    userId: string,
    createApplicationDto: CreateApplicationDto,
  ): Promise<ApplicationWithRelations> {
    const { jobId, ...data } = createApplicationDto;

    // Check if job exists globally (candidates apply to the job's workspace).
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job || job.deletedAt) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    if (job.status !== 'OPEN') {
      throw new ForbiddenException('Cannot apply to a job that is not open');
    }

    const workspaceId = job.workspaceId;

    // Get user to find/create candidate
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find or create candidate by email within the workspace.
    let candidate = await this.prisma.candidate.findUnique({
      where: {
        workspaceId_email: { workspaceId, email: user.email },
      },
    });

    if (!candidate) {
      // Auto-create candidate from user data within the workspace.
      candidate = await this.prisma.candidate.create({
        data: {
          email: user.email,
          fullName: user.fullName,
          workspaceId,
        },
      });
    }

    // Check if already applied
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

    return this.prisma.application.create({
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
  }

  async createWithCv(
    userId: string,
    file: Express.Multer.File,
    dto: UploadCvDto,
  ): Promise<UploadCvResponseDto> {
    const { jobId, coverLetter } = dto;

    const job = await this.findOpenJobOrThrow(jobId);
    const workspaceId = job.workspaceId;

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

  private async findOpenJobOrThrow(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
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

    // Role-based filtering within the current workspace
    if (userRole === 'RECRUITER') {
      // Recruiters see applications for their jobs within the workspace
      where.job = {
        workspaceId,
        createdById: userId,
      };
    } else if (userRole === 'INTERVIEWER') {
      // Interviewers see applications they're assigned to
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
      // Regular users see only their applications (via candidate lookup)
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

    // Admin can see all (still within the workspace)

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
    // Find application globally first (candidates apply to recruiter workspaces,
    // so candidate requests might resolve to a different workspace context).
    const application = await this.prisma.application.findFirst({
      where: { id },
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

    // Check access:
    // 1. Is the requesting user the applicant?
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isApplicant = user && application.candidate.email === user.email;

    // 2. Is the requesting user an active member of the application's workspace?
    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: application.workspaceId,
        userId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
    });
    const isWorkspaceMember = !!membership;

    // 3. Is the requesting user a system-level admin?
    const isAdmin = userRole === 'ADMIN';

    if (!isApplicant && !isWorkspaceMember && !isAdmin) {
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

    // Check user's roles
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isApplicant = user && application.candidate.email === user.email;

    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: application.workspaceId,
        userId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
    });
    const isWorkspaceRecruiter =
      membership &&
      [
        WorkspaceMemberRole.OWNER,
        WorkspaceMemberRole.ADMIN,
        WorkspaceMemberRole.RECRUITER,
      ].includes(membership.role);
    const isAdmin = userRole === 'ADMIN';

    // Only recruiter or admin can update stage/status/notes
    if (
      updateApplicationDto.stage ||
      updateApplicationDto.status ||
      updateApplicationDto.notes
    ) {
      if (!isWorkspaceRecruiter && !isAdmin) {
        throw new ForbiddenException(
          'Only recruiters can update application stage, status and notes',
        );
      }
    }

    // Applicants can only update cover letter
    if (!isWorkspaceRecruiter && !isAdmin && !isApplicant) {
      throw new ForbiddenException(
        'You do not have permission to update this application',
      );
    }

    const updateData: Partial<UpdateApplicationDto> & { reviewedAt?: Date } = {
      ...updateApplicationDto,
    };

    // Set reviewedAt when status changes
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

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isApplicant = user && application.candidate.email === user.email;
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
