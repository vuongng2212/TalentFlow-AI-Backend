import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Reflector } from '@nestjs/core';
import { WorkspaceMemberStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

import { SKIP_WORKSPACE_CONTEXT_KEY } from '../decorators/skip-workspace-context.decorator';

export const WORKSPACE_CONTEXT_KEY = 'workspaceId';

export interface RequestWithWorkspace {
  workspaceId?: string;
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

@Injectable()
export class WorkspaceContextGuard implements CanActivate {
  private readonly logger = new Logger(WorkspaceContextGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const skipWorkspaceContext = this.reflector.getAllAndOverride<boolean>(
      SKIP_WORKSPACE_CONTEXT_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<
      RequestWithWorkspace & {
        headers: Record<string, string | string[] | undefined>;
      }
    >();

    if (!request.user?.userId) {
      // JwtAuthGuard should have already populated the user; if not, fail.
      throw new ForbiddenException('Authenticated user context is required');
    }

    try {
      const headerValue = this.extractHeader(request);
      const resolvedWorkspaceId = await this.resolveWorkspaceId(
        request.user.userId,
        headerValue,
      );

      request.workspaceId = resolvedWorkspaceId;
      this.cls.set(WORKSPACE_CONTEXT_KEY, resolvedWorkspaceId);
    } catch (error) {
      if (!skipWorkspaceContext) {
        throw error;
      }
      this.logger.debug(
        `Skipped workspace context resolution error: ${(error as Error).message}`,
      );
    }

    return true;
  }

  private extractHeader(request: {
    headers: Record<string, string | string[] | undefined>;
  }): string | undefined {
    const raw = request.headers['x-workspace-id'];
    if (Array.isArray(raw)) {
      return raw[0];
    }
    if (typeof raw === 'string' && raw.length > 0) {
      return raw;
    }
    return undefined;
  }

  private async resolveWorkspaceId(
    userId: string,
    headerWorkspaceId: string | undefined,
  ): Promise<string> {
    if (headerWorkspaceId) {
      const membership = await this.prisma.workspaceMember.findFirst({
        where: {
          workspaceId: headerWorkspaceId,
          userId,
          status: WorkspaceMemberStatus.ACTIVE,
        },
        select: { id: true },
      });

      if (!membership) {
        throw new ForbiddenException(
          'You are not an active member of the requested workspace',
        );
      }

      return headerWorkspaceId;
    }

    // Fallback: user's active workspace
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeWorkspaceId: true },
    });

    if (user?.activeWorkspaceId) {
      const membership = await this.prisma.workspaceMember.findFirst({
        where: {
          workspaceId: user.activeWorkspaceId,
          userId,
          status: WorkspaceMemberStatus.ACTIVE,
        },
        select: { id: true },
      });

      if (membership) {
        return user.activeWorkspaceId;
      }
    }

    // Final fallback: first active membership
    const firstActive = await this.prisma.workspaceMember.findFirst({
      where: {
        userId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      orderBy: { createdAt: 'asc' },
      select: { workspaceId: true },
    });

    if (firstActive) {
      // Persist the resolved workspace as the user's active workspace.
      await this.prisma.user.update({
        where: { id: userId },
        data: { activeWorkspaceId: firstActive.workspaceId },
      });
      return firstActive.workspaceId;
    }

    this.logger.warn(
      `User ${userId} has no accessible workspace and no header was provided`,
    );
    throw new BadRequestException(
      'No accessible workspace. Provide x-workspace-id header or set an active workspace.',
    );
  }
}
