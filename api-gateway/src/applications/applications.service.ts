import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { QueryApplicationsDto } from './dto/query-applications.dto';
import { Prisma, ApplicationStatus, ApplicationStage } from '@prisma/client';

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
  constructor(private readonly prisma: PrismaService) {}

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
