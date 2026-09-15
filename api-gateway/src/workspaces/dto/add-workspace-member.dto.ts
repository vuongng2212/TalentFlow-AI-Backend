import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { WorkspaceMemberRole } from '@prisma/client';

export class AddWorkspaceMemberDto {
  @ApiProperty({
    example: 'recruiter@company.com',
    description: 'Email of an existing user in system',
  })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiPropertyOptional({
    enum: WorkspaceMemberRole,
    enumName: 'WorkspaceMemberRole',
    description:
      'Role assigned to the invited member. Defaults to RECRUITER when omitted.',
    default: WorkspaceMemberRole.RECRUITER,
  })
  @IsOptional()
  @IsEnum(WorkspaceMemberRole)
  role?: WorkspaceMemberRole;
}
