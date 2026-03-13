import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CandidateResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: 'John Doe' })
  fullName: string;

  @ApiPropertyOptional({ example: '+84 123 456 789' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/johndoe' })
  linkedinUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://minio.example.com/cv.pdf' })
  resumeUrl?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Number of applications' })
  applicationCount?: number;
}
