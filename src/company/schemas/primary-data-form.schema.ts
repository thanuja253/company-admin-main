import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type PrimaryDataFormDocument = PrimaryDataForm & Document;

/** document_status: 0 Pending, 1 Accepted, 2 Not Accepted, 3 Under Review */
export const PRIMARY_DATA_DOC_STATUS = {
  PENDING: 0,
  ACCEPTED: 1,
  NOT_ACCEPTED: 2,
  UNDER_REVIEW: 3,
} as const;

/** Section keys are dynamic from master_primary_data_checklist (no fixed list). */
export const PRIMARY_DATA_INFO_TYPES: readonly string[] = [];

@Schema({ timestamps: true, collection: 'primary_data_form' })
export class PrimaryDataForm {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Company', required: true })
  company_id: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'CompanyProject', required: true })
  project_id: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  data_id: MongooseSchema.Types.ObjectId; // ref to master_primary_data_checklist

  @Prop({ required: true })
  info_type: string; // gi, ee, wc, re, gge, wm, mcr, gsc, ps, gin, tar

  @Prop()
  parameter?: string;

  @Prop()
  category?: string;

  @Prop()
  gi_category?: string;

  @Prop()
  reference_unit?: string;

  @Prop()
  details?: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: 0 })
  fy1?: any;

  @Prop({ type: MongooseSchema.Types.Mixed, default: 0 })
  fy2?: any;

  @Prop({ type: MongooseSchema.Types.Mixed, default: 0 })
  fy3?: any;

  @Prop({ type: MongooseSchema.Types.Mixed, default: 0 })
  fy4?: any;

  @Prop({ type: MongooseSchema.Types.Mixed, default: 0 })
  fy5?: any;

  @Prop({ type: MongooseSchema.Types.Mixed })
  extrapolated?: any;

  @Prop({ type: MongooseSchema.Types.Mixed })
  lt_target?: any;

  @Prop()
  document?: string;

  /** 0 Pending, 1 Accepted, 2 Not Accepted, 3 Under Review */
  @Prop({ default: 0 })
  document_status?: number;

  @Prop()
  document_remarks?: string;

  /** Set when company saves this row after admin had rejected the section (resubmit / re-upload). */
  @Prop({ type: Date })
  company_resubmitted_at?: Date;

  @Prop({ default: 0 })
  final_submit?: number; // 0 or 1

  @Prop()
  additional_details?: string;
}

export const PrimaryDataFormSchema = SchemaFactory.createForClass(PrimaryDataForm);
PrimaryDataFormSchema.index({ company_id: 1, project_id: 1 });
PrimaryDataFormSchema.index({ company_id: 1, project_id: 1, info_type: 1 });
PrimaryDataFormSchema.index({ company_id: 1, project_id: 1, data_id: 1 });
