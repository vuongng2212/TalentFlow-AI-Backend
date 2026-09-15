import { ApiProperty } from '@nestjs/swagger';
import {
  ApplicationStatus,
  ApplicationStage,
  CvParsingStatus,
  Prisma,
} from '@prisma/client';

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

  @ApiProperty({
    enum: CvParsingStatus,
    enumName: 'CvParsingStatus',
    description: 'Trạng thái xử lý parsing CV của hệ thống AI',
  })
  cvParsingStatus: CvParsingStatus;

  @ApiProperty({ nullable: true })
  aiScore: number | null;

  @ApiProperty({ nullable: true })
  scoringReasoning: string | null;

  @ApiProperty({ nullable: true })
  parsedData: Prisma.JsonValue | null;

  @ApiProperty()
  appliedAt: Date;

  @ApiProperty({ nullable: true })
  reviewedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
