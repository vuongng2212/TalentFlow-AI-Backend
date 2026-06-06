import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export enum EntitlementContextDto {
  PERSONAL = 'personal',
  WORKSPACE = 'workspace',
}

export enum EntitlementActionDto {
  CV_SCORE = 'cv_score',
  CV_FIT_ANALYSIS = 'cv_fit_analysis',
}

export class EntitlementCheckDto {
  @ApiProperty({ enum: EntitlementContextDto })
  @IsEnum(EntitlementContextDto)
  contextType: EntitlementContextDto;

  @ApiPropertyOptional({
    description: 'Required when contextType is workspace',
    format: 'uuid',
  })
  @ValidateIf(
    (dto: EntitlementCheckDto) =>
      dto.contextType === EntitlementContextDto.WORKSPACE,
  )
  @IsUUID()
  workspaceId?: string;

  @ApiProperty({ enum: EntitlementActionDto })
  @IsEnum(EntitlementActionDto)
  action: EntitlementActionDto;

  @ApiPropertyOptional({
    default: false,
    description: 'Consume one quota unit when the action is allowed',
  })
  @IsOptional()
  @IsBoolean()
  consume?: boolean;
}
