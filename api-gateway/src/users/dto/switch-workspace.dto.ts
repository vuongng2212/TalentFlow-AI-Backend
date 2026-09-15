import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SwitchActiveWorkspaceDto {
  @ApiProperty({
    description: 'The workspace ID to set as the user active workspace.',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsUUID()
  workspaceId!: string;
}
