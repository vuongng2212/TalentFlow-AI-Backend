import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EntitlementCheckDto } from './dto/entitlement-check.dto';
import { SubscriptionsService } from './subscriptions.service';

interface UserPayload {
  id: string;
  email: string;
  role: string;
  fullName: string;
}

@ApiTags('Subscriptions')
@ApiBearerAuth('access-token')
@Controller()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('subscriptions/plans')
  @ApiOperation({ summary: 'List active subscription plans' })
  @ApiResponse({ status: 200, description: 'Subscription plans returned' })
  listPlans() {
    return this.subscriptionsService.listPlans();
  }

  @Get('subscriptions/me')
  @ApiOperation({ summary: 'Get current personal subscription status' })
  @ApiResponse({ status: 200, description: 'Personal subscription returned' })
  getMySubscription(@CurrentUser() user: UserPayload) {
    return this.subscriptionsService.getPersonalStatus(user.id);
  }

  @Post('subscriptions/me/plus')
  @ApiOperation({ summary: 'Activate Plus for current user' })
  @ApiResponse({ status: 201, description: 'Plus activated' })
  activatePlus(@CurrentUser() user: UserPayload) {
    return this.subscriptionsService.activatePlus(user.id);
  }

  @Post('subscriptions/entitlement/check')
  @ApiOperation({ summary: 'Check and optionally consume AI entitlement' })
  @ApiResponse({ status: 200, description: 'Entitlement decision returned' })
  checkEntitlement(
    @CurrentUser() user: UserPayload,
    @Body() dto: EntitlementCheckDto,
  ) {
    return this.subscriptionsService.checkEntitlement(user.id, dto);
  }

  @Get('workspaces/:workspaceId/subscription')
  @ApiOperation({ summary: 'Get workspace Business subscription status' })
  @ApiResponse({ status: 200, description: 'Workspace subscription returned' })
  getWorkspaceSubscription(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.subscriptionsService.getWorkspaceStatus(workspaceId, user.id);
  }

  @Post('workspaces/:workspaceId/subscription/business')
  @ApiOperation({ summary: 'Activate Business for workspace' })
  @ApiResponse({ status: 201, description: 'Business activated' })
  activateBusiness(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.subscriptionsService.activateBusiness(workspaceId, user.id);
  }
}
