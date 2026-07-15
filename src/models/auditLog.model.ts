import mongoose, { Schema, Document } from "mongoose";

// Generic audit trail for sensitive admin actions — manual payment
// verification, refunds, cancellations, and (later) price edits,
// withdrawal approvals, exports, and event edits per the roles &
// permissions roadmap item. Deliberately schema-loose (`metadata` is
// a Mixed blob) so new action types don't require a migration.

export type AuditAction =
  | "transaction.manual_verify"
  | "transaction.refund"
  | "transaction.cancel";

export interface IAuditLog extends Document {
  action: AuditAction | string;
  performedBy: mongoose.Types.ObjectId;
  targetType: string;
  targetId: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, index: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "admin", required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export default mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);