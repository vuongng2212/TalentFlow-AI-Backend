import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Delete,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role, WorkspaceMemberRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { WorkspaceRoles } from '../auth/decorators/workspace-roles.decorator';
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import {
  AcceptInvitationDto,
  CreateInvitationDto,
} from './dto/create-invitation.dto';
import { WorkspacesService } from './workspaces.service';

interface UserPayload {
  id: string;
  email: string;
  role: string;
  fullName: string;
}

@ApiTags('Workspaces')
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'x-workspace-id',
  required: false,
  description: 'Active workspace ID for resource isolation',
})
@Controller('workspaces')
@Roles(Role.RECRUITER, Role.ADMIN)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a workspace' })
  @ApiResponse({ status: 201, description: 'Workspace created successfully' })
  create(@CurrentUser() user: UserPayload, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(user.id, dto);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a member to workspace' })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  addMember(
    @Param('id') workspaceId: string,
    @CurrentUser() user: UserPayload,
    @Body() dto: AddWorkspaceMemberDto,
  ) {
    return this.workspacesService.addMember(workspaceId, user.id, dto);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List active workspace members' })
  @ApiResponse({ status: 200, description: 'Workspace members returned' })
  listMembers(
    @Param('id') workspaceId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.workspacesService.listMembers(workspaceId, user.id);
  }

  @Post(':id/invitations')
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceRoles(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN)
  @ApiOperation({
    summary: 'Invite a new member by email (Business Workspace only)',
  })
  @ApiResponse({ status: 201, description: 'Invitation created' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not on a Business Workspace or not Owner/Admin',
  })
  createInvitation(
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
    @CurrentUser() user: UserPayload,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.workspacesService.createInvitation(workspaceId, user.id, dto);
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a workspace invitation via token' })
  @ApiResponse({ status: 200, description: 'Invitation accepted' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @ApiResponse({ status: 403, description: 'Token issued to a different user' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  acceptInvitation(
    @CurrentUser() user: UserPayload,
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.workspacesService.acceptInvitation(user.id, dto.token);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from the workspace' })
  @ApiResponse({ status: 204, description: 'Member removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not owner/admin or trying to remove owner',
  })
  @ApiResponse({ status: 404, description: 'Member not found' })
  removeMember(
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
    @CurrentUser() user: UserPayload,
  ): Promise<void> {
    return this.workspacesService.removeMember(
      workspaceId,
      user.id,
      targetUserId,
    );
  }
}
