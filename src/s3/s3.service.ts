// src/common/services/s3.service.ts

import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
  } from '@aws-sdk/client-s3';
  import { Injectable } from '@nestjs/common';
  import { ConfigService } from '@nestjs/config';
  import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
  
  @Injectable()
  export class S3Service {
    private readonly s3Client: S3Client;
    private readonly bucket: string;
  
    constructor(private readonly configService: ConfigService) {
      this.bucket = this.configService.get<string>('AWS_S3_BUCKET');
  
      this.s3Client = new S3Client({
        region: this.configService.get<string>('AWS_REGION'),
        credentials: {
          accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
          secretAccessKey: this.configService.get<string>(
            'AWS_SECRET_ACCESS_KEY',
          ),
        },
      });
    }
  
    async uploadFile(
      file: Express.Multer.File,
      folder = 'uploads',
    ): Promise<string> {
      const key = `${folder}/${Date.now()}-${file.originalname}`;
  
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
  
      return key;
    }
  
    async deleteFile(key: string) {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
  
      return {
        message: 'File deleted successfully',
      };
    }
  
    async getSignedDownloadUrl(key: string) {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
  
      return getSignedUrl(this.s3Client, command, {
        expiresIn: 3600,
      });
    }
  
    async getSignedUploadUrl(
      fileName: string,
      contentType: string,
      folder = 'uploads',
    ) {
      const key = `${folder}/${Date.now()}-${fileName}`;
  
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });
  
      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600,
      });
  
      return {
        key,
        url,
      };
    }
  
    async listFiles(prefix = '') {
      const result = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
        }),
      );
  
      return result.Contents || [];
    }
  }
  