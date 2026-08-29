import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceMemberRole, WorkspaceMemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceMemberService } from './workspace-member.service';
import { WORKSPACE_SELECT } from './constants/workspace.constants';

@Injectable()
export class WorkspaceCoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memberService: WorkspaceMemberService,
  ) {}

  async create(ownerId: string, dto: CreateWorkspaceDto) {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: dto.name,
          isBusiness: dto.isBusiness ?? false,
          createdById: ownerId,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: ownerId,
          role: WorkspaceMemberRole.OWNER,
          status: WorkspaceMemberStatus.ACTIVE,
          invitedById: ownerId,
        },
      });

      // Make this the user's active workspace
      await tx.user.update({
        where: { id: ownerId },
        data: { activeWorkspaceId: workspace.id },
      });

      return workspace;
    });
  }

  async findAllForUser(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: {
        userId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      include: {
        workspace: {
          select: WORKSPACE_SELECT,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      ...m.workspace,
      memberRole: m.role,
    }));
  }

  async findOne(workspaceId: string, requesterId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        ...WORKSPACE_SELECT,
        members: {
          where: { status: WorkspaceMemberStatus.ACTIVE },
          select: { userId: true, role: true },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found`);
    }

    await this.memberService.ensureMemberAccess(workspaceId, requesterId);

    const myMembership = workspace.members.find(
      (m) => m.userId === requesterId,
    );

    return {
      id: workspace.id,
      name: workspace.name,
      isBusiness: workspace.isBusiness,
      createdById: workspace.createdById,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      memberRole: myMembership?.role ?? null,
      memberCount: workspace.members.length,
    };
  }

  async update(
    workspaceId: string,
    requesterId: string,
    dto: UpdateWorkspaceDto,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found`);
    }

    await this.memberService.ensureCanManageMembers(workspaceId, requesterId);

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isBusiness !== undefined && { isBusiness: dto.isBusiness }),
      },
      select: WORKSPACE_SELECT,
    });
  }
}
