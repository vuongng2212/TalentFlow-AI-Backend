import { ApiProperty } from '@nestjs/swagger';

export class IngestionResponseDto {
  @ApiProperty({ description: 'Whether the ingestion was accepted' })
  success: boolean;

  @ApiProperty({ description: 'Ingestion result data' })
  data: {
    applicationId: string;
    candidateId: string;
    status: string;
    message: string;
  };
}
