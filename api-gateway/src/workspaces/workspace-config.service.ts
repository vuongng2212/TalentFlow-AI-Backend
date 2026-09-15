import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WorkspaceConfigService {
  constructor(private readonly configService: ConfigService) {}

  get maxActiveMembers(): number {
    return this.configService.get<number>('WORKSPACE_MAX_ACTIVE_MEMBERS', 50);
  }

  get invitationExpiryDays(): number {
    return this.configService.get<number>(
      'WORKSPACE_INVITATION_EXPIRY_DAYS',
      7,
    );
  }

  get inviteBaseUrl(): string {
    return (
      this.configService.get<string>('WORKSPACE_INVITE_BASE_URL') ??
      'http://localhost:3001/invite/accept'
    );
  }
}
