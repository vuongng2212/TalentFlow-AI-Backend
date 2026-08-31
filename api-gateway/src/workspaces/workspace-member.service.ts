import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceMemberRole, WorkspaceMemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto';
import { WorkspaceConfigService } from './workspace-config.service';
import { USER_SUMMARY_SELECT } from './constants/workspace.constants';

@Injectable()
export class WorkspaceMemberService {
  private readonly logger = new Logger(WorkspaceMemberService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: WorkspaceConfigService,
  ) {}

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

    if (!workspace.isBusiness) {
      throw new ForbiddenException(
        'Workspace is not on an active Business plan',
      );
    }

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

      if (activeMembers >= this.configService.maxActiveMembers) {
        throw new ConflictException(
          `Workspace member cap (${this.configService.maxActiveMembers}) reached`,
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
              select: USER_SUMMARY_SELECT,
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
            select: USER_SUMMARY_SELECT,
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
          select: USER_SUMMARY_SELECT,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async removeMember(
    workspaceId: string,
    requesterId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.ensureCanManageMembers(workspaceId, requesterId);

    const targetMembership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: targetUserId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: {
        role: true,
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found or already removed');
    }

    if (targetMembership.role === WorkspaceMemberRole.OWNER) {
      throw new ForbiddenException('Cannot remove the workspace owner');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workspaceMember.update({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: targetUserId,
          },
        },
        data: {
          status: WorkspaceMemberStatus.REMOVED,
        },
      });

      const user = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { activeWorkspaceId: true },
      });

      if (user?.activeWorkspaceId === workspaceId) {
        const otherActive = await tx.workspaceMember.findFirst({
          where: {
            userId: targetUserId,
            status: WorkspaceMemberStatus.ACTIVE,
          },
          orderBy: { createdAt: 'asc' },
          select: { workspaceId: true },
        });

        await tx.user.update({
          where: { id: targetUserId },
          data: {
            activeWorkspaceId: otherActive?.workspaceId ?? null,
          },
        });
      }
    });

    this.logger.log(
      `User ${requesterId} removed user ${targetUserId} from workspace ${workspaceId}`,
    );
  }

  async ensureCanManageMembers(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
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

  async ensureMemberAccess(workspaceId: string, userId: string): Promise<void> {
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

  async ensureActiveMembership(
    workspaceId: string,
    userId: string,
  ): Promise<boolean> {
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
