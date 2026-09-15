import { SetMetadata } from '@nestjs/common';
import { WorkspaceMemberRole } from '@prisma/client';

export const WORKSPACE_ROLES_KEY = 'workspaceRoles';
export const WorkspaceRoles = (...roles: WorkspaceMemberRole[]) =>
  SetMetadata(WORKSPACE_ROLES_KEY, roles);
