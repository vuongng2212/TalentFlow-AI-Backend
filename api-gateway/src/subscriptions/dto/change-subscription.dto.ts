import { ApiProperty } from '@nestjs/swagger';
import { PlanCode } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeSubscriptionDto {
  @ApiProperty({
    enum: PlanCode,
    example: PlanCode.BUSINESS,
    description:
      'The active catalogue plan to select for the current workspace',
  })
  @IsEnum(PlanCode)
  planCode: PlanCode;
}
