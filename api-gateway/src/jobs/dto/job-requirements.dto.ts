import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class JobRequirementsDto {
  @ApiPropertyOptional({
    type: [String],
    example: ['React', 'Node.js'],
    description: 'Required skills for the job',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({
    example: '3+ years',
    description: 'Minimum experience expectation',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  experience?: string;
}
