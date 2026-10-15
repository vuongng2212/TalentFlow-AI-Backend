import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    example: 'DEMO_SERVICE',
    description:
      'Server-owned payable item code; money values are never accepted.',
  })
  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Z0-9][A-Z0-9_.-]*$/)
  payableItemCode!: string;
}
