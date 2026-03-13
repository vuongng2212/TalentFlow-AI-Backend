import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryCandidatesDto } from './dto/query-candidates.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import type { PaginatedResult } from '../common/dto/pagination.dto';
import type { Candidate } from '@prisma/client';

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: QueryCandidatesDto,
  ): Promise<
    PaginatedResult<Candidate & { _count: { applications: number } }>
  > {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.candidate.findMany({
        where,
        include: {
          _count: { select: { applications: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.candidate.count({ where }),
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

  async findOne(id: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: {
        applications: {
          where: { deletedAt: null },
          include: {
            job: {
              select: { id: true, title: true, department: true, status: true },
            },
          },
          orderBy: { appliedAt: 'desc' },
        },
      },
    });

    if (!candidate) {
      throw new NotFoundException(`Candidate with ID "${id}" not found`);
    }

    return candidate;
  }

  async update(id: string, data: UpdateCandidateDto) {
    const existing = await this.prisma.candidate.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Candidate with ID "${id}" not found`);
    }

    this.logger.log(`Updating candidate ${id}`);

    return this.prisma.candidate.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.linkedinUrl !== undefined && {
          linkedinUrl: data.linkedinUrl,
        }),
      },
    });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.candidate.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Candidate with ID "${id}" not found`);
    }

    this.logger.log(`Deleting candidate ${id}`);

    // Hard delete — Candidate model has no deletedAt
    // This will cascade delete all applications for this candidate
    await this.prisma.candidate.delete({ where: { id } });
  }
}
