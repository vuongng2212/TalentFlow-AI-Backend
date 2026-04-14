import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { WorkspacesService } from './workspaces.service';

interface UserPayload {
  id: string;
  email: string;
  role: string;
  fullName: string;
}

@ApiTags('Workspaces')
@ApiBearerAuth('access-token')
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
  listMembers(@Param('id') workspaceId: string, @CurrentUser() user: UserPayload) {
    return this.workspacesService.listMembers(workspaceId, user.id);
  }
}
