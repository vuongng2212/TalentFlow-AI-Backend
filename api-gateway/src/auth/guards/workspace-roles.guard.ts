import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceMemberRole, WorkspaceMemberStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WORKSPACE_ROLES_KEY } from '../decorators/workspace-roles.decorator';
import { RequestWithWorkspace } from './workspace-context.guard';

@Injectable()
export class WorkspaceRolesGuard implements CanActivate {
  private readonly logger = new Logger(WorkspaceRolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<
      WorkspaceMemberRole[]
    >(WORKSPACE_ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithWorkspace>();

    const userId = request.user?.id;
    const workspaceId = request.workspaceId;

    if (!userId) {
      throw new ForbiddenException('Authenticated user context is required');
    }

    if (!workspaceId) {
      throw new ForbiddenException(
        'Workspace context must be resolved before checking roles',
      );
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: { role: true },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You are not an active member of this workspace',
      );
    }

    if (!requiredRoles.includes(membership.role)) {
      this.logger.warn(
        `User ${userId} with role ${membership.role} attempted to access workspace ${workspaceId} requiring one of [${requiredRoles.join(', ')}]`,
      );
      throw new ForbiddenException(
        'You do not have permission to perform this action in the current workspace',
      );
    }

    return true;
  }
}
