import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AuthResponseDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'The unique identifier of the user',
  })
  id: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'The email address of the user',
  })
  email: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'The full name of the user',
  })
  fullName: string;

  @ApiProperty({
    enum: Role,
    example: Role.RECRUITER,
    description: 'The role of the user',
  })
  role: Role;

  @ApiProperty({
    example: '2023-01-01T00:00:00Z',
    description: 'The date and time when the user was created',
  })
  createdAt: Date;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'The user details',
    type: AuthResponseDto,
  })
  user: AuthResponseDto;

  @ApiProperty({
    example: 'Login successful',
    description: 'A message indicating the result of the login operation',
  })
  message: string;
}
