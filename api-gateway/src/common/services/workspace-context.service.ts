import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { WORKSPACE_CONTEXT_KEY } from '../../auth/guards/workspace-context.guard';

/**
 * Service for retrieving the resolved workspace context for the
 * current request. Backed by `nestjs-cls` so the same value is
 * available throughout the request lifecycle (services, async
 * operations, interceptors).
 */
@Injectable()
export class WorkspaceContextService {
  constructor(private readonly cls: ClsService) {}

  getWorkspaceId(): string {
    const value = this.cls.get<string>(WORKSPACE_CONTEXT_KEY);
    if (!value) {
      throw new Error(
        'Workspace context is not available. Ensure WorkspaceContextGuard is registered and the route is non-public.',
      );
    }
    return value;
  }

  /**
   * Returns the resolved workspaceId or `null` when no context has
   * been bound (e.g. internal background tasks). Prefer
   * {@link getWorkspaceId} inside HTTP request handlers.
   */
  getWorkspaceIdOrNull(): string | null {
    return this.cls.get<string>(WORKSPACE_CONTEXT_KEY) ?? null;
  }
}
