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
import { Prisma, ApplicationStatus, ApplicationStage } from '@prisma/client';
import { StorageService } from '../storage/storage.service';
import { QueueService } from '../queue/queue.service';
import { UploadCvDto } from './dto/upload-cv.dto';
import { UploadCvResponseDto } from './dto/upload-cv-response.dto';
import { generateCvFileKey } from '../common/utils/file-key.util';
import { sanitizeError } from '../common/utils/sanitize.util';

interface ApplicationWithRelations {
  id: string;
  jobId: string;
  candidateId: string;
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
  ) {}

  async create(
    userId: string,
    createApplicationDto: CreateApplicationDto,
  ): Promise<ApplicationWithRelations> {
    const { jobId, ...data } = createApplicationDto;

    // Check if job exists and is open
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job || job.deletedAt) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    if (job.status !== 'OPEN') {
      throw new ForbiddenException('Cannot apply to a job that is not open');
    }

    // Get user to find/create candidate
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find or create candidate by email
    let candidate = await this.prisma.candidate.findUnique({
      where: { email: user.email },
    });

    if (!candidate) {
      // Auto-create candidate from user data
      candidate = await this.prisma.candidate.create({
        data: {
          email: user.email,
          fullName: user.fullName,
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

    await this.findOpenJobOrThrow(jobId);
    const candidate = await this.findOrCreateCandidateOrThrow(userId);
    await this.ensureNoDuplicateApplication(jobId, candidate.id);

    const { fileKey, uploadUrl } = await this.uploadCvOrThrow(file);

    let applicationId: string | null = null;

    try {
      const application = await this.prisma.application.create({
        data: {
          jobId,
          candidateId: candidate.id,
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

  private async findOrCreateCandidateOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const candidate = await this.prisma.candidate.findUnique({
      where: { email: user.email },
    });

    if (candidate) {
      return candidate;
    }

    return this.prisma.candidate.create({
      data: {
        email: user.email,
        fullName: user.fullName,
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
    const fileKey = generateCvFileKey(file.originalname);

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
      deletedAt: null,
    };

    // Role-based filtering
    if (userRole === 'RECRUITER') {
      // Recruiters see applications for their jobs
      where.job = {
        createdById: userId,
      };
    } else if (userRole === 'INTERVIEWER') {
      // Interviewers see applications they're assigned to (future feature)
      // For now, find candidate by user email and show their applications
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const candidate = await this.prisma.candidate.findUnique({
          where: { email: user.email },
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
          where: { email: user.email },
        });
        if (candidate) {
          where.candidateId = candidate.id;
        }
      }
    }

    // Admin can see all, so no filter for ADMIN role

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
    const application = await this.prisma.application.findUnique({
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

    // Check access - need to find user's candidate to check if they're the applicant
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const candidate = user
      ? await this.prisma.candidate.findUnique({ where: { email: user.email } })
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

    // Check user's candidate status
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const candidate = user
      ? await this.prisma.candidate.findUnique({ where: { email: user.email } })
      : null;

    // Only recruiter (job owner) or admin can update stage/status/notes
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

    // Applicants can only update cover letter
    if (!isRecruiter && !isAdmin && !isApplicant) {
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

    // Check user's candidate status
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const candidate = user
      ? await this.prisma.candidate.findUnique({ where: { email: user.email } })
      : null;

    // Only applicant or admin can delete
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
