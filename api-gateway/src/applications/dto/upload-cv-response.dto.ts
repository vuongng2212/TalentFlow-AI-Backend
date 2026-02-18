import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadCvResponseDto {
  @ApiProperty()
  applicationId: string;

  @ApiProperty()
  fileKey: string;

  @ApiProperty()
  fileUrl: string;

  @ApiPropertyOptional()
  presignedUrl?: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  message: string;
}
