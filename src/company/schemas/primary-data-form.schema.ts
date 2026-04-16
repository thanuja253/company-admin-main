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

  @Prop({ default: 0 })
  fy1?: number;

  @Prop({ default: 0 })
  fy2?: number;

  @Prop({ default: 0 })
  fy3?: number;

  @Prop({ default: 0 })
  fy4?: number;

  @Prop({ default: 0 })
  fy5?: number;

  @Prop()
  extrapolated?: number;

  @Prop()
  lt_target?: number;

  @Prop()
  document?: string;

  /** 0 Pending, 1 Accepted, 2 Not Accepted, 3 Under Review */
  @Prop({ default: 0 })
  document_status?: number;

  @Prop()
  document_remarks?: string;

  @Prop({ default: 0 })
  final_submit?: number; // 0 or 1

  @Prop()
  additional_details?: string;
}

export const PrimaryDataFormSchema = SchemaFactory.createForClass(PrimaryDataForm);
PrimaryDataFormSchema.index({ company_id: 1, project_id: 1 });
PrimaryDataFormSchema.index({ company_id: 1, project_id: 1, info_type: 1 });
PrimaryDataFormSchema.index({ company_id: 1, project_id: 1, data_id: 1 });
