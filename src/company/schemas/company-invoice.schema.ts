import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CompanyInvoiceDocument = CompanyInvoice & Document;

/** payment_for: per_inv = Payments/Proforma, inv = Tax Invoices */
export const PAYMENT_FOR_PROFORMA = 'per_inv';
export const PAYMENT_FOR_TAX = 'inv';

@Schema({ timestamps: true, collection: 'companies_payments_invoices_info' })
export class CompanyInvoice {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Company', required: true })
  company_id: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'CompanyProject', required: true })
  project_id: MongooseSchema.Types.ObjectId;

  /** 'per_inv' = Proforma, 'inv' = Tax Invoice */
  @Prop({ required: true })
  payment_for: string;

  @Prop()
  invoice_document?: string;

  @Prop()
  invoice_document_filename?: string;

  @Prop({ default: 0 })
  payable_amount?: number;

  @Prop({ default: 0 })
  tax_amount?: number;

  @Prop({ default: 0 })
  total_amount?: number;

  /** GST percentage rates */
  @Prop({ default: 0 })
  sgst?: number;

  @Prop({ default: 0 })
  cgst?: number;

  @Prop({ default: 0 })
  igst?: number;

  /** GST component amounts */
  @Prop({ default: 0 })
  sgst_amt?: number;

  @Prop({ default: 0 })
  cgst_amt?: number;

  @Prop({ default: 0 })
  igst_amt?: number;

  /** GST state-code metadata */
  @Prop()
  supplier_state_code?: string;

  @Prop()
  place_of_supply_state_code?: string;

  /** Derived from state codes: intra | inter */
  @Prop()
  transaction_type?: string;

  @Prop()
  is_intra_state?: boolean;

  /** 'Online' | 'Offline' */
  @Prop()
  payment_type?: string;

  /** 0 = pending, 1 = paid, etc. */
  @Prop({ default: 0 })
  payment_status?: number;

  @Prop()
  trans_id?: string;

  /** Path to supporting document (offline payment proof) */
  @Prop()
  offline_tran_doc?: string;

  @Prop()
  offline_tran_doc_filename?: string;

  /** Approval status for display (COMPANY_APPROVAL_STATUS / APPROVAL_STATUS_COLORS) */
  @Prop({ default: 0 })
  approval_status?: number;

  /** Optional approval remarks (frontend may send remarks/approval_remarks). */
  @Prop()
  remarks?: string;

  @Prop()
  approval_remarks?: string;

  /** Increments when payment is not acknowledged/rejected; frontend can use as form re-open key. */
  @Prop({ default: 0 })
  reassign_key?: number;

  /** Keeps old payment submissions when invoice is not acknowledged/rejected. */
  @Prop({ type: Array, default: [] })
  reupload_documents?: Array<{
    payment_type?: string;
    trans_id?: string;
    offline_tran_doc?: string;
    offline_tran_doc_filename?: string;
    moved_at?: Date;
  }>;
}

export const CompanyInvoiceSchema = SchemaFactory.createForClass(CompanyInvoice);
CompanyInvoiceSchema.index({ company_id: 1, project_id: 1 });
CompanyInvoiceSchema.index({ company_id: 1, project_id: 1, payment_for: 1 });
