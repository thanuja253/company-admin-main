import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class PresignedUploadDto {
  @IsString()
  @MaxLength(255)
  fileName: string;

  @IsString()
  @MaxLength(128)
  contentType: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(/^[a-zA-Z0-9_\-/]+$/, {
    message: 'folder may only contain letters, numbers, _, -, and /',
  })
  folder?: string;
}
