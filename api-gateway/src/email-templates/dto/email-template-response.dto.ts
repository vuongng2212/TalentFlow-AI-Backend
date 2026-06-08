import { ApiProperty } from '@nestjs/swagger';
import { EmailTemplate } from '@prisma/client';

export class EmailTemplateResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  subject!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static from(template: EmailTemplate): EmailTemplateResponseDto {
    return {
      id: template.id,
      name: template.name,
      subject: template.subject,
      body: template.body,
      workspaceId: template.workspaceId,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}
