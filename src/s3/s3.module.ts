import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { S3Service } from './s3.service';
import { S3Controller } from './s3.controller';
import { PortalJwtAuthGuard, S3ConfiguredGuard } from './guards/portal-jwt-auth.guard';
import { Company, CompanySchema } from '../company/schemas/company.schema';
import { Admin, AdminSchema } from '../admin/schemas/admin.schema';
import { Assessor, AssessorSchema } from '../company/schemas/assessor.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Company.name, schema: CompanySchema },
      { name: Admin.name, schema: AdminSchema },
      { name: Assessor.name, schema: AssessorSchema },
    ]),
  ],
  controllers: [S3Controller],
  providers: [S3Service, PortalJwtAuthGuard, S3ConfiguredGuard],
  exports: [S3Service],
})
export class S3Module {}
