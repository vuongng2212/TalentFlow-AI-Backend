import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { Job, Prisma, WorkspaceMemberRole } from '@prisma/client';
import { JobRequirementsDto } from './dto/job-requirements.dto';
import { WorkspaceContextService } from '../common/services/workspace-context.service';
import { RedisService } from '../redis/redis.service';

const WRITE_ROLES: WorkspaceMemberRole[] = [
  WorkspaceMemberRole.OWNER,
  WorkspaceMemberRole.ADMIN,
  WorkspaceMemberRole.RECRUITER,
];

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceContext: WorkspaceContextService,
    private readonly redis: RedisService,
  ) {}

  private toRequirementsJson(
    requirements?: JobRequirementsDto,
  ): Prisma.InputJsonValue | undefined {
    if (!requirements) {
      return undefined;
    }

    return {
      ...(requirements.skills ? { skills: requirements.skills } : {}),
      ...(requirements.experience
        ? { experience: requirements.experience }
        : {}),
    } satisfies Prisma.InputJsonObject;
  }

  async create(createdById: string, createJobDto: CreateJobDto): Promise<Job> {
    const workspaceId = this.workspaceContext.getWorkspaceId();
    const { requirements, ...jobData } = createJobDto;

    const job = await this.prisma.job.create({
      data: {
        ...jobData,
        ...(requirements
          ? { requirements: this.toRequirementsJson(requirements) }
          : {}),
        createdById,
        workspaceId,
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
    await this.invalidateWorkspaceCache(workspaceId);
    return job;
  }

  async findAll(query: QueryJobsDto) {
    const workspaceId = this.workspaceContext.getWorkspaceId();
    const {
      page = 1,
      limit = 10,
      search,
      status,
      employmentType,
      department,
      salaryMin,
      salaryMax,
      skills,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.JobWhereInput = {
      workspaceId,
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

    if (salaryMin !== undefined) {
      where.salaryMax = { gte: salaryMin };
    }

    if (salaryMax !== undefined) {
      where.salaryMin = { lte: salaryMax };
    }

    if (skills) {
      const skillList = skills.split(',').map((s) => s.trim().toLowerCase());
      where.requirements = {
        path: ['skills'],
        array_contains: skillList,
      };
    }

    const cacheKey = `jobs:workspace:${workspaceId}:list:${JSON.stringify(query)}`;
    return this.getCached(cacheKey, async () => {
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
    });
  }

  async findOne(id: string): Promise<Job> {
    const workspaceId = this.workspaceContext.getWorkspaceId();
    return this.getCached(
      `jobs:workspace:${workspaceId}:item:${id}`,
      async () => {
        const job = await this.prisma.job.findFirst({
          where: { id, workspaceId },
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
      },
    );
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    updateJobDto: UpdateJobDto,
  ): Promise<Job> {
    this.assertCanMutate(userRole);
    await this.findOne(id);
    const { requirements, ...jobData } = updateJobDto;

    const workspaceId = this.workspaceContext.getWorkspaceId();
    const job = await this.prisma.job.update({
      where: { id },
      data: {
        ...jobData,
        ...(requirements
          ? { requirements: this.toRequirementsJson(requirements) }
          : {}),
      },
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
    await this.invalidateWorkspaceCache(workspaceId);
    return job;
  }

  async remove(id: string, userId: string, userRole: string): Promise<void> {
    this.assertCanMutate(userRole);
    await this.findOne(id);

    await this.prisma.job.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.invalidateWorkspaceCache(this.workspaceContext.getWorkspaceId());
  }

  private async getCached<T>(key: string, load: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.redis.get(key);
      if (cached !== null) {
        return JSON.parse(cached) as T;
      }
    } catch {
      return load();
    }

    const value = await load();
    try {
      await this.redis.set(key, JSON.stringify(value), 60);
    } catch {
      return value;
    }
    return value;
  }

  private async invalidateWorkspaceCache(workspaceId: string): Promise<void> {
    try {
      await this.redis.delByPattern(`jobs:workspace:${workspaceId}:*`);
    } catch {
      return;
    }
  }

  private assertCanMutate(userRole: string): void {
    if (userRole === 'ADMIN') {
      return;
    }
    if (!WRITE_ROLES.includes(userRole as WorkspaceMemberRole)) {
      throw new ForbiddenException(
        'You do not have permission to mutate resources in this workspace',
      );
    }
  }
}
