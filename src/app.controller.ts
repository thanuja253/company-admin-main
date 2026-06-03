import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      status: 'success',
      message: 'Green Co API is running',
      version: '1.0.0',
      endpoints: {
        auth: '/api/company/auth',
        register: '/api/company/auth/register',
        login: '/api/company/auth/login',
        forgotPassword: '/api/company/auth/forgot-password',
        s3: {
          presignedUpload: 'POST /api/s3/presigned-upload',
          confirm: 'POST /api/s3/confirm',
          downloadUrl: 'GET /api/s3/download-url?key=',
          resolveUrl: 'GET /api/s3/resolve-url?stored=',
        },
      },
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'success',
      message: 'API is healthy',
      timestamp: new Date().toISOString(),
    };
  }
}

