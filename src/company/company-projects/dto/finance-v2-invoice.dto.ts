import { IsIn, IsNumber, IsOptional, IsString, Matches } from 'class-validator';

export class FinanceV2InvoiceDto {
  @IsIn(['per_inv', 'inv'])
  payment_for: 'per_inv' | 'inv';

  @IsNumber()
  payable_amount: number;

  @IsOptional()
  @IsNumber()
  tax_amount?: number;

  @IsOptional()
  @IsNumber()
  total_amount?: number;

  @IsOptional()
  @IsNumber()
  sgst?: number;

  @IsOptional()
  @IsNumber()
  cgst?: number;

  @IsOptional()
  @IsNumber()
  igst?: number;

  @IsOptional()
  @IsNumber()
  sgst_amt?: number;

  @IsOptional()
  @IsNumber()
  cgst_amt?: number;

  @IsOptional()
  @IsNumber()
  igst_amt?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}$/, { message: 'supplier_state_code must be exactly 2 digits' })
  supplier_state_code?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}$/, { message: 'place_of_supply_state_code must be exactly 2 digits' })
  place_of_supply_state_code?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

