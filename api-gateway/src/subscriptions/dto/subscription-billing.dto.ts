import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionPlanCode } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSubscriptionCheckoutDto {
  @ApiProperty({
    enum: [SubscriptionPlanCode.PLUS, SubscriptionPlanCode.BUSINESS],
  })
  @IsEnum(SubscriptionPlanCode)
  planCode: 'PLUS' | 'BUSINESS';
}

export class MomoPaymentResultDto {
  @ApiProperty()
  @IsString()
  partnerCode: string;

  @ApiProperty()
  @IsString()
  requestId: string;

  @ApiProperty()
  @IsString()
  orderId: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderInfo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partnerClientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  callbackToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transId?: string;

  @ApiProperty()
  @IsInt()
  resultCode: number;

  @ApiProperty()
  @IsString()
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payType?: string;

  @ApiProperty()
  @IsInt()
  responseTime: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  extraData?: string;

  @ApiProperty()
  @IsString()
  signature: string;
}

export class InternalConfirmPaymentDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ConfirmPaymentParamsDto {
  @ApiProperty()
  @IsUUID()
  paymentId: string;
}
