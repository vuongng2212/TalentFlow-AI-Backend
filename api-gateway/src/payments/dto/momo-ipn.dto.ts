import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';
import { MomoIpnPayload } from '../momo/momo.types';

export class MomoIpnDto implements MomoIpnPayload {
  @IsString()
  @Length(1, 50)
  partnerCode!: string;

  @IsString()
  @Length(1, 200)
  @Matches(/^[0-9a-zA-Z]([-_.]*[0-9a-zA-Z]+)*$/)
  orderId!: string;

  @IsString()
  @Length(1, 50)
  requestId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(50_000_000)
  amount!: number;

  @IsString()
  @Length(1, 255)
  orderInfo!: string;

  @IsString()
  @Length(1, 100)
  orderType!: string;

  @Transform(({ value }: { value: unknown }) => String(value))
  @IsString()
  @Length(1, 32)
  transId!: string;

  @Type(() => Number)
  @IsInt()
  resultCode!: number;

  @IsString()
  @Length(0, 1024)
  message!: string;

  @IsString()
  @Length(1, 100)
  payType!: string;

  @Transform(({ value }: { value: unknown }) => String(value))
  @IsString()
  @Length(1, 32)
  responseTime!: string;

  @IsString()
  @Length(0, 1000)
  extraData!: string;

  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  signature!: string;
}
