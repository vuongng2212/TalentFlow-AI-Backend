import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceMemberRole, WorkspaceMemberStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private get maxActiveMembers(): number {
    return this.configService.get<number>('WORKSPACE_MAX_ACTIVE_MEMBERS', 50);
  }

  async create(ownerId: string, dto: CreateWorkspaceDto) {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: dto.name,
          isBusiness: dto.isBusiness ?? false,
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

      return workspace;
    });
  }

  async addMember(
    workspaceId: string,
    requesterId: string,
    dto: AddWorkspaceMemberDto,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found`);
    }

    this.ensureBusinessPlanActive(workspace);

    await this.ensureCanManageMembers(workspaceId, requesterId);

    const invitedUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!invitedUser || invitedUser.deletedAt) {
      throw new NotFoundException('User with provided email does not exist');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: invitedUser.id,
          },
        },
      });

      if (existing?.status === WorkspaceMemberStatus.ACTIVE) {
        throw new ConflictException('User is already an active member');
      }

      const activeMembers = await tx.workspaceMember.count({
        where: {
          workspaceId,
          status: WorkspaceMemberStatus.ACTIVE,
        },
      });

      if (activeMembers >= this.maxActiveMembers) {
        throw new ConflictException(
          `Workspace member cap (${this.maxActiveMembers}) reached`,
        );
      }

      if (existing) {
        return tx.workspaceMember.update({
          where: {
            workspaceId_userId: {
              workspaceId,
              userId: invitedUser.id,
            },
          },
          data: {
            role: dto.role ?? WorkspaceMemberRole.RECRUITER,
            status: WorkspaceMemberStatus.ACTIVE,
            invitedById: requesterId,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
              },
            },
          },
        });
      }

      return tx.workspaceMember.create({
        data: {
          workspaceId,
          userId: invitedUser.id,
          role: dto.role ?? WorkspaceMemberRole.RECRUITER,
          status: WorkspaceMemberStatus.ACTIVE,
          invitedById: requesterId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      });
    });
  }

  async listMembers(workspaceId: string, requesterId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found`);
    }

    await this.ensureMemberAccess(workspaceId, requesterId);

    return this.prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  private ensureBusinessPlanActive(workspace: { isBusiness: boolean }) {
    // Temporary proxy until billing/subscription module is available:
    // `isBusiness=true` represents active Business entitlement for membership.
    if (!workspace.isBusiness) {
      throw new ForbiddenException(
        'Workspace is not on an active Business plan',
      );
    }
  }

  private async ensureCanManageMembers(workspaceId: string, userId: string) {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: {
        role: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    if (
      membership.role !== WorkspaceMemberRole.OWNER &&
      membership.role !== WorkspaceMemberRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only workspace owner/admin can manage members',
      );
    }
  }

  private async ensureMemberAccess(workspaceId: string, userId: string) {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }
  }

  async ensureActiveMembership(workspaceId: string, userId: string) {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: { id: true },
    });

    return Boolean(membership);
  }
}
