import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { SkipWorkspaceContext } from '../auth/decorators/skip-workspace-context.decorator';
import { MomoIpnDto } from './dto/momo-ipn.dto';
import { PaymentsService } from './payments.service';

@ApiTags('MoMo IPN')
@Controller('payments/momo')
export class MomoIpnController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('ipn')
  @Public()
  @SkipWorkspaceContext()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Receive a signed MoMo payment notification' })
  @ApiResponse({ status: 204, description: 'Delivery was safely handled' })
  async receive(@Body() payload: MomoIpnDto): Promise<void> {
    await this.payments.handleIpn(payload);
  }
}
