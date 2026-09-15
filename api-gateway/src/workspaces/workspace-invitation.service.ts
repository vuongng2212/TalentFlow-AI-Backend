import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceMemberRole, WorkspaceMemberStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { WorkspaceMemberInvitedEvent } from '../queue/interfaces/workspace-member-invited-event.interface';
import { WorkspaceConfigService } from './workspace-config.service';
import { WorkspaceMemberService } from './workspace-member.service';

@Injectable()
export class WorkspaceInvitationService {
  private readonly logger = new Logger(WorkspaceInvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: WorkspaceConfigService,
    private readonly queueService: QueueService,
    private readonly memberService: WorkspaceMemberService,
  ) {}

  ensureBusinessPlanActive(workspace: { isBusiness: boolean }) {
    if (!workspace.isBusiness) {
      throw new ForbiddenException(
        'Workspace is not on an active Business plan',
      );
    }
  }

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
    await this.memberService.ensureCanManageMembers(workspaceId, requesterId);

    const token = randomUUID();
    const expiresAt = new Date(
      Date.now() +
        this.configService.invitationExpiryDays * 24 * 60 * 60 * 1000,
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

    const inviteUrl = `${this.configService.inviteBaseUrl}?token=${token}`;

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
      this.logger.error(
        `Failed to publish workspace.member.invited event: ${(error as Error).message}`,
      );
    }

    return invitation;
  }

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
}
