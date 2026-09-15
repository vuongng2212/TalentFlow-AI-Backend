import { Injectable } from '@nestjs/common';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { WorkspaceCoreService } from './workspace-core.service';
import { WorkspaceMemberService } from './workspace-member.service';
import { WorkspaceInvitationService } from './workspace-invitation.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly coreService: WorkspaceCoreService,
    private readonly memberService: WorkspaceMemberService,
    private readonly invitationService: WorkspaceInvitationService,
  ) {}

  async create(ownerId: string, dto: CreateWorkspaceDto) {
    return this.coreService.create(ownerId, dto);
  }

  async findAllForUser(userId: string) {
    return this.coreService.findAllForUser(userId);
  }

  async findOne(workspaceId: string, requesterId: string) {
    return this.coreService.findOne(workspaceId, requesterId);
  }

  async update(
    workspaceId: string,
    requesterId: string,
    dto: UpdateWorkspaceDto,
  ) {
    return this.coreService.update(workspaceId, requesterId, dto);
  }

  async addMember(
    workspaceId: string,
    requesterId: string,
    dto: AddWorkspaceMemberDto,
  ) {
    return this.memberService.addMember(workspaceId, requesterId, dto);
  }

  async listMembers(workspaceId: string, requesterId: string) {
    return this.memberService.listMembers(workspaceId, requesterId);
  }

  async createInvitation(
    workspaceId: string,
    requesterId: string,
    dto: CreateInvitationDto,
  ) {
    return this.invitationService.createInvitation(
      workspaceId,
      requesterId,
      dto,
    );
  }

  async acceptInvitation(acceptorId: string, token: string) {
    return this.invitationService.acceptInvitation(acceptorId, token);
  }

  async ensureActiveMembership(workspaceId: string, userId: string) {
    return this.memberService.ensureActiveMembership(workspaceId, userId);
  }

  async removeMember(
    workspaceId: string,
    requesterId: string,
    targetUserId: string,
  ): Promise<void> {
    return this.memberService.removeMember(
      workspaceId,
      requesterId,
      targetUserId,
    );
  }
}
