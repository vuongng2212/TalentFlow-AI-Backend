import { Global, Module } from '@nestjs/common';
import { WorkspaceContextService } from './services/workspace-context.service';
import { SecurityAuditService } from './services/security-audit.service';

@Global()
@Module({
  providers: [WorkspaceContextService, SecurityAuditService],
  exports: [WorkspaceContextService, SecurityAuditService],
})
export class CommonModule {}
