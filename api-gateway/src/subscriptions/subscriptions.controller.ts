import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Body,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WorkspaceMemberRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SkipWorkspaceContext } from '../auth/decorators/skip-workspace-context.decorator';
import { WorkspaceRoles } from '../auth/decorators/workspace-roles.decorator';
import { WorkspaceContextService } from '../common/services/workspace-context.service';
import { ChangeSubscriptionDto } from './dto/change-subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

interface AuthenticatedUser {
  id: string;
}

@ApiTags('Subscriptions')
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'x-workspace-id',
  required: false,
  description: 'Optional active workspace ID for current subscription routes',
})
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly workspaceContext: WorkspaceContextService,
  ) {}

  @Get('plans')
  @SkipWorkspaceContext()
  @ApiOperation({ summary: 'List active subscription plans' })
  @ApiResponse({ status: 200, description: 'Plan catalogue returned' })
  listPlans() {
    return this.subscriptionsService.listPlans();
  }

  @Get('current')
  @ApiOperation({ summary: 'Get the current workspace subscription' })
  @ApiResponse({ status: 200, description: 'Current subscription returned' })
  @ApiResponse({ status: 400, description: 'No accessible workspace' })
  @ApiResponse({ status: 403, description: 'Workspace membership required' })
  @ApiResponse({ status: 404, description: 'Current subscription missing' })
  getCurrentSubscription() {
    return this.subscriptionsService.getCurrentSubscription(
      this.workspaceContext.getWorkspaceId(),
    );
  }

  @Put('current')
  @HttpCode(HttpStatus.OK)
  @WorkspaceRoles(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN)
  @ApiOperation({ summary: 'Select an active plan for the current workspace' })
  @ApiResponse({ status: 200, description: 'Current subscription updated' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 403, description: 'Owner or administrator required' })
  @ApiResponse({
    status: 404,
    description: 'Plan unavailable or subscription missing',
  })
  changeCurrentSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangeSubscriptionDto,
  ) {
    return this.subscriptionsService.changePlan(
      this.workspaceContext.getWorkspaceId(),
      user.id,
      dto.planCode,
    );
  }
}
