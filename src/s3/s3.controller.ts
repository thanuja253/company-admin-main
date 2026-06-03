import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { S3Service } from './s3.service';
import { PresignedUploadDto } from './dto/presigned-upload.dto';
import { PortalJwtAuthGuard, S3ConfiguredGuard } from './guards/portal-jwt-auth.guard';

@Controller('api/s3')
@UseGuards(PortalJwtAuthGuard, S3ConfiguredGuard)
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  /**
   * POST /api/s3/upload — multipart field "file", optional JSON/query folder.
   * Prefer presigned-upload for large files from the browser.
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException({ status: 'error', message: 'No file uploaded (field: file)' });
    }
    const key = await this.s3Service.uploadFile(file, folder || 'uploads');

    return {
      success: true,
      key,
      storageValue: S3Service.toStorageValue(key),
    };
  }

  /**
   * POST /api/s3/presigned-upload — get a signed PUT URL (recommended for Next.js panels).
   */
  @Post('presigned-upload')
  async getPresignedUploadUrl(@Body() body: PresignedUploadDto) {
    return this.s3Service.getSignedUploadUrl(
      body.fileName,
      body.contentType,
      body.folder || 'uploads',
    );
  }

  /**
   * POST /api/s3/confirm — verify object exists after client PUT (optional safety check).
   */
  @Post('confirm')
  async confirmUpload(@Body() body: { key: string }) {
    if (!body?.key?.trim()) {
      throw new BadRequestException({ status: 'error', message: 'key is required' });
    }
    await this.s3Service.confirmObjectExists(body.key);
    return {
      success: true,
      key: S3Service.toS3Key(body.key),
      storageValue: S3Service.toStorageValue(body.key),
    };
  }

  /**
   * GET /api/s3/download-url?key=uploads/... or key=s3:uploads/...
   */
  @Get('download-url')
  async getDownloadUrl(@Query('key') key: string) {
    if (!key?.trim()) {
      throw new BadRequestException({ status: 'error', message: 'key query param is required' });
    }
    const url = await this.s3Service.getSignedDownloadUrl(key);
    return { success: true, url };
  }

  /**
   * GET /api/s3/resolve-url?stored=... — http | local path | s3: key → one URL for &lt;img&gt; / window.open
   */
  @Get('resolve-url')
  async resolveUrl(@Query('stored') stored: string) {
    if (!stored?.trim()) {
      throw new BadRequestException({ status: 'error', message: 'stored query param is required' });
    }
    const url = await this.s3Service.resolvePublicUrl(stored);
    return { success: true, url };
  }

  @Get('list')
  async listFiles(@Query('prefix') prefix?: string) {
    return this.s3Service.listFiles(prefix || '');
  }

  @Delete()
  async deleteFile(@Query('key') key: string) {
    if (!key?.trim()) {
      throw new BadRequestException({ status: 'error', message: 'key query param is required' });
    }
    return this.s3Service.deleteFile(key);
  }
}
