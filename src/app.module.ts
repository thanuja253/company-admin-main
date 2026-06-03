import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyAuthModule } from './company/company-auth/company-auth.module';
import { CompanyProjectsModule } from './company/company-projects/company-projects.module';
import { NotificationsModule } from './company/notifications/notifications.module';
import { FacilitatorsModule } from './company/facilitators/facilitators.module';
import { RegistrationMastersModule } from './company/registration-masters/registration-masters.module';
import { MailModule } from './mail/mail.module';
import { HelpDeskModule } from './company/help-desk/help-desk.module';
import { AdminAuthModule } from './admin/admin-auth/admin-auth.module';
import { AssessorAuthModule } from './assessor/assessor-auth/assessor-auth.module';
import { AssessorManagementModule } from './admin/assessor-management/assessor-management.module';
import { AppController } from './app.controller';
import { S3Module } from './s3/s3.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/greenco',
        serverSelectionTimeoutMS: 10000, // 10 seconds
        socketTimeoutMS: 45000, // 45 seconds
        connectTimeoutMS: 10000, // 10 seconds
      }),
      inject: [ConfigService],
    }),
    S3Module,
    CompanyAuthModule,
    CompanyProjectsModule,
    NotificationsModule,
    FacilitatorsModule,
    RegistrationMastersModule,
    MailModule,
    HelpDeskModule,
    AdminAuthModule,
    AssessorAuthModule,
    AssessorManagementModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

