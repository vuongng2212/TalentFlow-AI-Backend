import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;
}
