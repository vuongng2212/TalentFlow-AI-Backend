import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'TalentFlow Hiring Team', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Enable Business capabilities for workspace',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isBusiness?: boolean;
}
