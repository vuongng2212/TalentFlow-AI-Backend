import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
} from './dto/create-email-template.dto';
import { QueryEmailTemplatesDto } from './dto/query-email-templates.dto';
import { WorkspaceContextService } from '../common/services/workspace-context.service';

@Injectable()
export class EmailTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceContext: WorkspaceContextService,
  ) {}

  async create(dto: CreateEmailTemplateDto) {
    const workspaceId = this.workspaceContext.getWorkspaceId();

    return this.prisma.emailTemplate.create({
      data: {
        name: dto.name,
        subject: dto.subject,
        body: dto.body,
        workspaceId,
      },
    });
  }

  async findAll(query: QueryEmailTemplatesDto) {
    const workspaceId = this.workspaceContext.getWorkspaceId();
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { workspaceId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.emailTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.emailTemplate.count({ where }),
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
    const workspaceId = this.workspaceContext.getWorkspaceId();
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, workspaceId },
    });

    if (!template) {
      throw new NotFoundException(`Email template with ID "${id}" not found`);
    }

    return template;
  }

  async update(id: string, dto: UpdateEmailTemplateDto) {
    await this.findOne(id);

    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.body !== undefined && { body: dto.body }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.emailTemplate.delete({ where: { id } });
  }
}
