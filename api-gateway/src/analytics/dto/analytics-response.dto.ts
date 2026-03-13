import { ApiProperty } from '@nestjs/swagger';

export class OverviewDto {
  @ApiProperty({ example: 15 })
  totalJobs: number;

  @ApiProperty({ example: 8 })
  openJobs: number;

  @ApiProperty({ example: 120 })
  totalCandidates: number;

  @ApiProperty({ example: 95 })
  totalApplications: number;

  @ApiProperty({ example: 12 })
  hiredCount: number;

  @ApiProperty({ example: 12.6, description: 'Hire rate as percentage' })
  hireRate: number;
}

export class PipelineStageDto {
  @ApiProperty({ example: 'APPLIED' })
  stage: string;

  @ApiProperty({ example: 45 })
  count: number;
}

export class TrendPointDto {
  @ApiProperty({ example: '2026-03-01' })
  date: string;

  @ApiProperty({ example: 5 })
  applications: number;
}

export class TopJobDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Senior Developer' })
  title: string;

  @ApiProperty({ example: 'Engineering' })
  department: string | null;

  @ApiProperty({ example: 'OPEN' })
  status: string;

  @ApiProperty({ example: 12 })
  applicationCount: number;
}
