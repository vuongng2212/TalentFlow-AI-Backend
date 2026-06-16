import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import { QueryInterviewsDto } from './dto/query-interviews.dto';
import type { PaginatedResult } from '../common/dto/pagination.dto';
import type { Interview } from '@prisma/client';
import { WorkspaceContextService } from '../common/services/workspace-context.service';

@Injectable()
export class InterviewsService {
  private readonly logger = new Logger(InterviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceContext: WorkspaceContextService,
  ) {}

  async create(dto: CreateInterviewDto): Promise<Interview> {
    const workspaceId = this.workspaceContext.getWorkspaceId();

    // Verify application exists within the current workspace
    const application = await this.prisma.application.findFirst({
      where: { id: dto.applicationId, workspaceId, deletedAt: null },
    });

    if (!application) {
      throw new NotFoundException(
        `Application with ID "${dto.applicationId}" not found`,
      );
    }

    // Verify interviewer exists if provided
    if (dto.interviewerId) {
      const interviewer = await this.prisma.user.findUnique({
        where: { id: dto.interviewerId, deletedAt: null },
      });

      if (!interviewer) {
        throw new NotFoundException(
          `Interviewer with ID "${dto.interviewerId}" not found`,
        );
      }
    }

    // Validate scheduledAt is in the future
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException(
        'Interview must be scheduled in the future',
      );
    }

    this.logger.log(
      `Creating interview for application ${dto.applicationId} in workspace ${workspaceId}`,
    );

    return this.prisma.interview.create({
      data: {
        applicationId: dto.applicationId,
        workspaceId,
        scheduledAt,
        duration: dto.duration ?? 60,
        type: dto.type ?? 'VIDEO',
        location: dto.location,
        notes: dto.notes,
        interviewerId: dto.interviewerId,
      },
      include: {
        application: {
          select: {
            id: true,
            candidate: { select: { id: true, fullName: true, email: true } },
            job: { select: { id: true, title: true } },
          },
        },
        interviewer: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  async findAll(
    query: QueryInterviewsDto,
  ): Promise<PaginatedResult<Interview>> {
    const workspaceId = this.workspaceContext.getWorkspaceId();
    const {
      page = 1,
      limit = 10,
      applicationId,
      interviewerId,
      type,
      status,
      sortBy = 'scheduledAt',
      sortOrder = 'asc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      workspaceId,
    };

    if (applicationId) where.applicationId = applicationId;
    if (interviewerId) where.interviewerId = interviewerId;
    if (type) where.type = type;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.interview.findMany({
        where,
        include: {
          application: {
            select: {
              id: true,
              candidate: { select: { id: true, fullName: true, email: true } },
              job: { select: { id: true, title: true } },
            },
          },
          interviewer: {
            select: { id: true, fullName: true, email: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.interview.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Interview> {
    const workspaceId = this.workspaceContext.getWorkspaceId();
    const interview = await this.prisma.interview.findFirst({
      where: { id, workspaceId },
      include: {
        application: {
          select: {
            id: true,
            stage: true,
            status: true,
            candidate: {
              select: { id: true, fullName: true, email: true, phone: true },
            },
            job: { select: { id: true, title: true, department: true } },
          },
        },
        interviewer: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!interview) {
      throw new NotFoundException(`Interview with ID "${id}" not found`);
    }

    return interview;
  }

  async update(id: string, dto: UpdateInterviewDto): Promise<Interview> {
    const workspaceId = this.workspaceContext.getWorkspaceId();
    const existing = await this.prisma.interview.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException(`Interview with ID "${id}" not found`);
    }

    // Validate scheduledAt is in the future if being updated
    if (dto.scheduledAt) {
      const scheduledAt = new Date(dto.scheduledAt);
      if (scheduledAt <= new Date()) {
        throw new BadRequestException(
          'Interview must be scheduled in the future',
        );
      }
    }

    // Verify interviewer exists if being changed
    if (dto.interviewerId) {
      const interviewer = await this.prisma.user.findUnique({
        where: { id: dto.interviewerId, deletedAt: null },
      });

      if (!interviewer) {
        throw new NotFoundException(
          `Interviewer with ID "${dto.interviewerId}" not found`,
        );
      }
    }

    this.logger.log(`Updating interview ${id} in workspace ${workspaceId}`);

    return this.prisma.interview.update({
      where: { id },
      data: {
        ...(dto.scheduledAt !== undefined && {
          scheduledAt: new Date(dto.scheduledAt),
        }),
        ...(dto.duration !== undefined && { duration: dto.duration }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.interviewerId !== undefined && {
          interviewerId: dto.interviewerId,
        }),
      },
      include: {
        application: {
          select: {
            id: true,
            candidate: { select: { id: true, fullName: true, email: true } },
            job: { select: { id: true, title: true } },
          },
        },
        interviewer: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  async remove(id: string): Promise<void> {
    const workspaceId = this.workspaceContext.getWorkspaceId();
    const existing = await this.prisma.interview.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException(`Interview with ID "${id}" not found`);
    }

    this.logger.log(`Cancelling interview ${id} in workspace ${workspaceId}`);

    // Soft cancel — change status to CANCELLED instead of hard delete
    await this.prisma.interview.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }
}
