import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  DEFAULT_S3_MAX_UPLOAD_BYTES,
  S3_STORAGE_PREFIX,
} from './s3.constants';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client | null;
  private readonly bucket: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET');
    if (this.isConfigured()) {
      this.s3Client = new S3Client({
        region: this.configService.get<string>('AWS_REGION'),
        credentials: {
          accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
          secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!,
        },
      });
    } else {
      this.s3Client = null;
    }
  }

  isConfigured(): boolean {
    return !!(
      this.bucket &&
      this.configService.get<string>('AWS_REGION') &&
      this.configService.get<string>('AWS_ACCESS_KEY_ID') &&
      this.configService.get<string>('AWS_SECRET_ACCESS_KEY')
    );
  }

  private client(): S3Client {
    if (!this.s3Client || !this.bucket) {
      throw new ServiceUnavailableException({
        status: 'error',
        message: 'S3 is not configured on the server.',
      });
    }
    return this.s3Client;
  }

  private maxUploadBytes(): number {
    const raw = this.configService.get<string>('S3_MAX_UPLOAD_BYTES');
    const n = raw ? Number(raw) : DEFAULT_S3_MAX_UPLOAD_BYTES;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_S3_MAX_UPLOAD_BYTES;
  }

  private assertFileSize(size: number): void {
    const max = this.maxUploadBytes();
    if (size > max) {
      throw new BadRequestException({
        status: 'error',
        message: `File exceeds maximum size of ${max} bytes`,
      });
    }
  }

  static isS3StorageValue(value: string): boolean {
    return typeof value === 'string' && value.startsWith(S3_STORAGE_PREFIX);
  }

  static toStorageValue(key: string): string {
    const trimmed = String(key || '').replace(/^\/+/, '');
    if (!trimmed) {
      throw new BadRequestException({ status: 'error', message: 'S3 key is required' });
    }
    if (trimmed.startsWith(S3_STORAGE_PREFIX)) {
      return trimmed;
    }
    return `${S3_STORAGE_PREFIX}${trimmed}`;
  }

  static toS3Key(stored: string): string {
    return stored.startsWith(S3_STORAGE_PREFIX)
      ? stored.slice(S3_STORAGE_PREFIX.length)
      : stored.replace(/^\/+/, '');
  }

  /** Resolve a DB value (http URL, local path, or s3:key) to a browser-ready URL. */
  async resolvePublicUrl(stored: string | undefined | null): Promise<string | null> {
    if (!stored || !String(stored).trim()) {
      return null;
    }
    const value = String(stored).trim();
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    if (S3Service.isS3StorageValue(value)) {
      return this.getSignedDownloadUrl(S3Service.toS3Key(value));
    }
    const baseUrl = (process.env.API_BASE_URL || 'http://localhost:3020').replace(/\/$/, '');
    return `${baseUrl}/${value.replace(/^\//, '')}`;
  }

  /** Upload multer buffer to S3; returns `s3:…` storage value for Mongo/API. */
  async storeMulterFile(
    file: Express.Multer.File,
    folder = 'uploads',
  ): Promise<string> {
    const key = await this.uploadFile(file, folder);
    return S3Service.toStorageValue(key);
  }

  async uploadFile(
    file: Express.Multer.File,
    folder = 'uploads',
  ): Promise<string> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({ status: 'error', message: 'No file uploaded' });
    }
    this.assertFileSize(file.size);

    const key = `${folder.replace(/\/$/, '')}/${Date.now()}-${file.originalname}`;
    await this.client().send(
      new PutObjectCommand({
        Bucket: this.bucket!,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return key;
  }

  async deleteFile(key: string) {
    const normalized = S3Service.toS3Key(key);
    await this.client().send(
      new DeleteObjectCommand({
        Bucket: this.bucket!,
        Key: normalized,
      }),
    );

    return {
      success: true,
      message: 'File deleted successfully',
      key: normalized,
    };
  }

  async getSignedDownloadUrl(key: string) {
    const normalized = S3Service.toS3Key(key);
    const command = new GetObjectCommand({
      Bucket: this.bucket!,
      Key: normalized,
    });

    return getSignedUrl(this.client(), command, {
      expiresIn: Number(this.configService.get('S3_DOWNLOAD_EXPIRES_SEC') || 3600),
    });
  }

  async getSignedUploadUrl(
    fileName: string,
    contentType: string,
    folder = 'uploads',
  ) {
    const safeName = String(fileName || '')
      .replace(/[/\\]/g, '_')
      .trim();
    if (!safeName) {
      throw new BadRequestException({ status: 'error', message: 'fileName is required' });
    }
    if (!contentType?.trim()) {
      throw new BadRequestException({ status: 'error', message: 'contentType is required' });
    }

    const key = `${folder.replace(/\/$/, '')}/${Date.now()}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket!,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.client(), command, {
      expiresIn: Number(this.configService.get('S3_UPLOAD_EXPIRES_SEC') || 3600),
    });

    return {
      key,
      url,
      storageValue: S3Service.toStorageValue(key),
    };
  }

  async confirmObjectExists(key: string): Promise<void> {
    const normalized = S3Service.toS3Key(key);
    try {
      await this.client().send(
        new HeadObjectCommand({
          Bucket: this.bucket!,
          Key: normalized,
        }),
      );
    } catch {
      throw new NotFoundException({
        status: 'error',
        message: `Object not found in S3: ${normalized}`,
      });
    }
  }

  async listFiles(prefix = '') {
    const result = await this.client().send(
      new ListObjectsV2Command({
        Bucket: this.bucket!,
        Prefix: prefix,
      }),
    );

    return {
      success: true,
      items: (result.Contents || []).map((o) => ({
        key: o.Key,
        size: o.Size,
        lastModified: o.LastModified,
      })),
    };
  }
}
