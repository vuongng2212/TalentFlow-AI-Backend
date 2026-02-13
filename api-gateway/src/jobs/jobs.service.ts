import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { Job } from '@prisma/client';

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createdById: string, createJobDto: CreateJobDto): Promise<Job> {
    return this.prisma.job.create({
      data: {
        ...createJobDto,
        createdById,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
    });
  }

  async findAll(query: QueryJobsDto) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      employmentType,
      department,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (employmentType) {
      where.employmentType = employmentType;
    }

    if (department) {
      where.department = { contains: department, mode: 'insensitive' };
    }

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          _count: {
            select: { applications: true },
          },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      data: jobs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Job> {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
        _count: {
          select: { applications: true },
        },
      },
    });

    if (!job || job.deletedAt) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    return job;
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    updateJobDto: UpdateJobDto,
  ): Promise<Job> {
    const job = await this.findOne(id);

    // Check ownership (only user who created or admin can update)
    if (job.createdById !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException(
        'You do not have permission to update this job',
      );
    }

    return this.prisma.job.update({
      where: { id },
      data: updateJobDto,
      include: {
        createdBy: {
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
    const job = await this.findOne(id);

    // Check ownership (only user who created or admin can delete)
    if (job.createdById !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException(
        'You do not have permission to delete this job',
      );
    }

    await this.prisma.job.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
