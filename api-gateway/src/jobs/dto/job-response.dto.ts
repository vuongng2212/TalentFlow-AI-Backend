import { ApiProperty } from '@nestjs/swagger';
import { EmploymentType, JobStatus } from '@prisma/client';

export class JobResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ nullable: true })
  department: string | null;

  @ApiProperty({ nullable: true })
  location: string | null;

  @ApiProperty({ enum: EmploymentType })
  employmentType: EmploymentType;

  @ApiProperty({ nullable: true })
  salaryMin: number | null;

  @ApiProperty({ nullable: true })
  salaryMax: number | null;

  @ApiProperty({ enum: JobStatus })
  status: JobStatus;

  @ApiProperty({ nullable: true })
  requirements: any | null;

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
