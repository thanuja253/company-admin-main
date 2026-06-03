import { memoryStorage } from 'multer';
import { DEFAULT_S3_MAX_UPLOAD_BYTES } from '../s3/s3.constants';

/** Multer options: buffer in memory for S3 upload (no local uploads/ writes). */
export function multerMemoryOptions(
  maxBytes = DEFAULT_S3_MAX_UPLOAD_BYTES,
): {
  storage: ReturnType<typeof memoryStorage>;
  limits: { fileSize: number };
} {
  return {
    storage: memoryStorage(),
    limits: { fileSize: maxBytes },
  };
}
