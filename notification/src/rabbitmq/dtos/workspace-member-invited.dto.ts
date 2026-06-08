import { IsEmail, IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class WorkspaceMemberInvitedDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  workspaceName!: string;

  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsNotEmpty()
  // Treated as a relative path or absolute URL — we keep this loose
  // because invite URLs may be tenant-specific frontends.
  inviteUrl!: string;
}
