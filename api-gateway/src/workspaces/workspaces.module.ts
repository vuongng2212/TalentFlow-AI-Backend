import { Module } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceConfigService } from './workspace-config.service';
import { WorkspaceCoreService } from './workspace-core.service';
import { WorkspaceMemberService } from './workspace-member.service';
import { WorkspaceInvitationService } from './workspace-invitation.service';
import { WorkspacesCleanupService } from './workspaces-cleanup.service';

@Module({
  controllers: [WorkspacesController],
  providers: [
    WorkspacesService,
    WorkspaceConfigService,
    WorkspaceCoreService,
    WorkspaceMemberService,
    WorkspaceInvitationService,
    WorkspacesCleanupService,
  ],
  exports: [
    WorkspacesService,
    WorkspaceConfigService,
    WorkspaceCoreService,
    WorkspaceMemberService,
    WorkspaceInvitationService,
  ],
})
export class WorkspacesModule {}
