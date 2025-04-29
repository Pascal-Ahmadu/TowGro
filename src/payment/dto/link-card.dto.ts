import { IsCreditCard, IsNumberString, Length } from 'class-validator';

export class LinkCardDto {
  @IsCreditCard()
  cardNumber: string;

  @IsNumberString()
  @Length(3, 4)
  cvv: string;

  @IsNumberString()
  @Length(2, 2)
  expiryMonth: string;

  @IsNumberString()
  @Length(4, 4)
  expiryYear: string;
}
