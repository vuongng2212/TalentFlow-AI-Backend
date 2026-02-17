import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStatus, ApplicationStage } from '@prisma/client';

export class ApplicationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jobId: string;

  @ApiProperty()
  candidateId: string;

  @ApiProperty({ enum: ApplicationStage })
  stage: ApplicationStage;

  @ApiProperty({ enum: ApplicationStatus })
  status: ApplicationStatus;

  @ApiProperty({ nullable: true })
  cvFileKey: string | null;

  @ApiProperty({ nullable: true })
  cvFileUrl: string | null;

  @ApiProperty({ nullable: true })
  coverLetter: string | null;

  @ApiProperty({ nullable: true })
  notes: string | null;

  @ApiProperty()
  appliedAt: Date;

  @ApiProperty({ nullable: true })
  reviewedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
