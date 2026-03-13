import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TrendsQueryDto {
  @ApiPropertyOptional({
    description: 'Number of days to look back',
    default: 30,
    minimum: 7,
    maximum: 90,
  })
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(90)
  @Type(() => Number)
  days?: number = 30;
}

export class TopJobsQueryDto {
  @ApiPropertyOptional({
    description: 'Number of top jobs to return',
    default: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  limit?: number = 5;
}
