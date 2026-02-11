import { Role } from '@prisma/client';

export class AuthResponseDto {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  createdAt: Date;
}

export class LoginResponseDto {
  user: AuthResponseDto;
  message: string;
}
