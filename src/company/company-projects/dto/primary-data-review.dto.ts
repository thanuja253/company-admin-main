import { IsIn, IsOptional, IsString } from 'class-validator';

/** Admin review state per primary-data section. */
export class PrimaryDataSectionReviewDto {
  @IsString()
  info_type: string;

  @IsString()
  @IsIn(['accepted', 'rejected', 'under_review'], {
    message: 'status must be one of: accepted, rejected, under_review',
  })
  status: 'accepted' | 'rejected' | 'under_review';

  @IsOptional()
  @IsString()
  remarks?: string;
}
