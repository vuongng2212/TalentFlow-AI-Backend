import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ConfirmPaymentParamsDto,
  CreateSubscriptionCheckoutDto,
  InternalConfirmPaymentDto,
  MomoPaymentResultDto,
} from './dto/subscription-billing.dto';
import { SubscriptionsService } from './subscriptions.service';

interface UserPayload {
  id: string;
  email: string;
  role: Role;
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
  @ApiOperation({ summary: 'Get current subscription and payment status' })
  @ApiResponse({ status: 200, description: 'Subscription status returned' })
  getMySubscription(@CurrentUser() user: UserPayload) {
    return this.subscriptionsService.getPersonalStatus(user.id);
  }

  @Post('subscriptions/checkout')
  @ApiOperation({ summary: 'Start MoMo checkout for a paid plan' })
  @ApiResponse({ status: 201, description: 'Pending payment created' })
  createCheckout(
    @CurrentUser() user: UserPayload,
    @Body() dto: CreateSubscriptionCheckoutDto,
  ) {
    return this.subscriptionsService.createCheckout(user.id, dto);
  }

  @Post('subscriptions/momo/ipn')
  @HttpCode(202)
  @ApiOperation({ summary: 'Receive and verify MoMo payment result' })
  @ApiResponse({ status: 202, description: 'Payment result accepted' })
  receiveMomoIpn(@Body() dto: MomoPaymentResultDto) {
    return this.subscriptionsService.receiveMomoIpn(dto);
  }

  @Post('internal/subscriptions/payments/:paymentId/confirm')
  @HttpCode(200)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Confirm a verified payment and activate subscription',
  })
  @ApiResponse({ status: 200, description: 'Subscription activation returned' })
  confirmPayment(
    @Param() params: ConfirmPaymentParamsDto,
    @Body() dto: InternalConfirmPaymentDto = {},
  ) {
    return this.subscriptionsService.confirmPaymentInternally(
      params.paymentId,
      dto,
    );
  }
}
