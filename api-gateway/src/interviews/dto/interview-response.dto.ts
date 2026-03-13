import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InterviewType, InterviewStatus } from '@prisma/client';

export class InterviewResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid' })
  applicationId: string;

  @ApiProperty()
  scheduledAt: Date;

  @ApiProperty({ example: 60 })
  duration: number;

  @ApiProperty({ enum: InterviewType })
  type: InterviewType;

  @ApiPropertyOptional()
  location?: string | null;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty({ enum: InterviewStatus })
  status: InterviewStatus;

  @ApiPropertyOptional({ example: 'uuid' })
  interviewerId?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
