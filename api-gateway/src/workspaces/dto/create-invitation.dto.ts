import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkspaceMemberRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateInvitationDto {
  @ApiProperty({
    description: 'The email address of the invited user.',
    example: 'invitee@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    description: 'The role to assign when the invitation is accepted.',
    enum: WorkspaceMemberRole,
    default: WorkspaceMemberRole.RECRUITER,
  })
  @IsEnum(WorkspaceMemberRole)
  @IsOptional()
  role?: WorkspaceMemberRole;
}

export class AcceptInvitationDto {
  @ApiProperty({
    description: 'The token from the invitation email.',
    example: 'd748f3b1-21ac-46bd-991c-2ee9a184f42f',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
