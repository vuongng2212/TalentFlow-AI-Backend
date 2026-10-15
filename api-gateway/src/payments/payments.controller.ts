import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WorkspaceMemberRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspaceRoles } from '../auth/decorators/workspace-roles.decorator';
import { WorkspaceContextService } from '../common/services/workspace-context.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { PaymentsService } from './payments.service';

interface AuthenticatedUser {
  id: string;
}

@ApiTags('Payments')
@ApiCookieAuth('accessTokenCookie')
@ApiHeader({
  name: 'x-workspace-id',
  required: false,
  description:
    'Optional active workspace ID validated by the existing context guard.',
})
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly workspaceContext: WorkspaceContextService,
  ) {}

  @Post()
  @WorkspaceRoles(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Opaque 8–255 character key; it is hashed and never returned.',
  })
  @ApiOperation({ summary: 'Create or safely replay a MoMo checkout' })
  @ApiResponse({
    status: 201,
    description: 'Durable payment with ready checkout',
  })
  @ApiResponse({
    status: 202,
    description: 'Durable payment with checkout recovery pending',
  })
  @ApiResponse({
    status: 409,
    description: 'Idempotency key is bound to another intent',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreatePaymentDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const payment = await this.payments.createPayment(
      this.workspaceContext.getWorkspaceId(),
      user.id,
      dto.payableItemCode,
      idempotencyKey ?? '',
    );
    response.status(
      payment.checkoutStatus === 'READY'
        ? HttpStatus.CREATED
        : HttpStatus.ACCEPTED,
    );
    return payment;
  }

  @Get()
  @ApiOperation({ summary: 'List payments in the active workspace' })
  async list(@Query() query: ListPaymentsQueryDto) {
    return this.payments.listPayments(
      this.workspaceContext.getWorkspaceId(),
      query,
    );
  }

  @Get(':paymentReference')
  @ApiOperation({ summary: 'Read one payment and non-sensitive audit history' })
  async get(@Param('paymentReference') paymentReference: string) {
    return this.payments.getPayment(
      this.workspaceContext.getWorkspaceId(),
      paymentReference,
    );
  }

  @Get(':paymentReference/invoice')
  @ApiOperation({ summary: 'Read the immutable commercial receipt' })
  @ApiResponse({
    status: 409,
    description: 'Payment is not a confirmed success',
  })
  async getInvoice(@Param('paymentReference') paymentReference: string) {
    return this.payments.getInvoice(
      this.workspaceContext.getWorkspaceId(),
      paymentReference,
    );
  }

  @Get(':paymentReference/invoice/download')
  @ApiOperation({
    summary: 'Obtain a short-lived private receipt download URL',
  })
  @ApiResponse({
    status: 202,
    description: 'Receipt exists but deterministic rendering is still retrying',
  })
  @ApiResponse({
    status: 200,
    description: 'A short-lived private receipt download URL',
  })
  async downloadInvoice(
    @Param('paymentReference') paymentReference: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.payments.getInvoiceDownload(
      this.workspaceContext.getWorkspaceId(),
      paymentReference,
    );
    if ('documentStatus' in result) {
      response.status(HttpStatus.ACCEPTED);
    }
    return result;
  }

  @Post(':paymentReference/reconcile')
  @HttpCode(HttpStatus.ACCEPTED)
  @WorkspaceRoles(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN)
  @ApiOperation({
    summary: 'Queue safe reconciliation of an uncertain payment',
  })
  async reconcile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentReference') paymentReference: string,
  ) {
    return this.payments.scheduleReconciliation(
      this.workspaceContext.getWorkspaceId(),
      user.id,
      paymentReference,
    );
  }
}
