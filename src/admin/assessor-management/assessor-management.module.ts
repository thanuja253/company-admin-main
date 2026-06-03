import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { S3Module } from '../../s3/s3.module';
import { AssessorManagementController } from './assessor-management.controller';
import { AssessorManagementService } from './assessor-management.service';
import { Assessor, AssessorSchema } from '../../company/schemas/assessor.schema';
import { State, StateSchema } from '../../company/schemas/state.schema';
import { Industry, IndustrySchema } from '../../company/schemas/industry.schema';

@Module({
  imports: [
    S3Module,
    MongooseModule.forFeature([
      { name: Assessor.name, schema: AssessorSchema },
      { name: State.name, schema: StateSchema },
      { name: Industry.name, schema: IndustrySchema },
    ]),
  ],
  controllers: [AssessorManagementController],
  providers: [AssessorManagementService],
})
export class AssessorManagementModule {}
