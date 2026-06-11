import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkspaceMemberRole, WorkspaceMemberStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { WorkspaceMemberInvitedEvent } from '../queue/interfaces/workspace-member-invited-event.interface';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
  ) {}

  private get maxActiveMembers(): number {
    return this.configService.get<number>('WORKSPACE_MAX_ACTIVE_MEMBERS', 50);
  }

  private get invitationExpiryDays(): number {
    return this.configService.get<number>(
      'WORKSPACE_INVITATION_EXPIRY_DAYS',
      7,
    );
  }

  private get inviteBaseUrl(): string {
    return (
      this.configService.get<string>('WORKSPACE_INVITE_BASE_URL') ??
      'http://localhost:3001/invite/accept'
    );
  }

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

  /**
   * Creates a secure token-based invitation. Returns the new
   * invitation record (including the token) and publishes a
   * `workspace.member.invited` event so the notification service
   * can dispatch the email.
   */
  async createInvitation(
    workspaceId: string,
    requesterId: string,
    dto: CreateInvitationDto,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found`);
    }

    this.ensureBusinessPlanActive(workspace);
    await this.ensureCanManageMembers(workspaceId, requesterId);

    const token = randomUUID();
    const expiresAt = new Date(
      Date.now() + this.invitationExpiryDays * 24 * 60 * 60 * 1000,
    );

    const invitation = await this.prisma.workspaceInvitation.create({
      data: {
        email: dto.email.toLowerCase(),
        workspaceId,
        token,
        role: dto.role ?? WorkspaceMemberRole.RECRUITER,
        invitedById: requesterId,
        expiresAt,
      },
    });

    // Find the user (if they exist) and create/update a membership row
    // in INVITED status. We do not require the user to exist before
    // invitation; they may register later. But if they exist, we record
    // a membership so dashboards can show the pending state.
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      await this.prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: existingUser.id,
          },
        },
        create: {
          workspaceId,
          userId: existingUser.id,
          role: dto.role ?? WorkspaceMemberRole.RECRUITER,
          status: WorkspaceMemberStatus.INVITED,
          invitedById: requesterId,
        },
        update: {
          role: dto.role ?? WorkspaceMemberRole.RECRUITER,
          status: WorkspaceMemberStatus.INVITED,
          invitedById: requesterId,
        },
      });
    }

    const inviteUrl = `${this.inviteBaseUrl}?token=${token}`;

    const event: WorkspaceMemberInvitedEvent = {
      email: dto.email.toLowerCase(),
      workspaceName: workspace.name,
      token,
      inviteUrl,
    };

    try {
      await this.queueService.publishWorkspaceMemberInvited(event);
      this.logger.log(
        `Published workspace.member.invited for ${dto.email} -> workspace ${workspaceId}`,
      );
    } catch (error) {
      // The invitation row is the source of truth; surfacing a failure
      // here allows the API to return 201 with a warning header in
      // future iterations. For now, log and continue.
      this.logger.error(
        `Failed to publish workspace.member.invited event: ${(error as Error).message}`,
      );
    }

    return invitation;
  }

  /**
   * Accepts an invitation token. Transitions the membership to
   * ACTIVE and removes the invitation row. The acceptor's active
   * workspace is updated to the new workspace.
   */
  async acceptInvitation(acceptorId: string, token: string) {
    if (!token) {
      throw new BadRequestException('Invitation token is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.workspaceInvitation.findUnique({
        where: { token },
        include: { workspace: true },
      });

      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }

      if (invitation.expiresAt.getTime() <= Date.now()) {
        throw new BadRequestException('Invitation token has expired');
      }

      const acceptor = await tx.user.findUnique({
        where: { id: acceptorId },
      });

      if (!acceptor) {
        throw new NotFoundException('Acceptor user not found');
      }

      if (acceptor.email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new ForbiddenException(
          'Invitation is addressed to a different email address',
        );
      }

      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId: acceptorId,
          },
        },
        create: {
          workspaceId: invitation.workspaceId,
          userId: acceptorId,
          role: invitation.role,
          status: WorkspaceMemberStatus.ACTIVE,
          invitedById: invitation.invitedById,
        },
        update: {
          status: WorkspaceMemberStatus.ACTIVE,
          role: invitation.role,
          invitedById: invitation.invitedById,
        },
      });

      await tx.workspaceInvitation.delete({ where: { token } });

      await tx.user.update({
        where: { id: acceptorId },
        data: { activeWorkspaceId: invitation.workspaceId },
      });

      this.logger.log(
        `User ${acceptorId} accepted invitation for workspace ${invitation.workspaceId}`,
      );

      return {
        workspaceId: invitation.workspaceId,
        workspaceName: invitation.workspace.name,
        role: invitation.role,
      };
    });
  }

  private ensureBusinessPlanActive(workspace: { isBusiness: boolean }) {
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
}
