import { IsIn, IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';

export class SubmitFinancePaymentDto {
  @IsIn(['per_inv', 'inv'])
  payment_for: 'per_inv' | 'inv';

  @IsIn(['Online', 'Offline'])
  payment_type: 'Online' | 'Offline';

  /** Required when payment_type is Offline. */
  @ValidateIf((o) => o.payment_type === 'Offline')
  @IsNotEmpty({ message: 'Transaction ID is required when payment mode is Offline' })
  @IsString()
  @Matches(/^\S(?!.*\s{2,}).*\S$|^\S+$/, {
    message: 'Transaction ID cannot have leading/trailing spaces or double spaces',
  })
  trans_id?: string;
}
