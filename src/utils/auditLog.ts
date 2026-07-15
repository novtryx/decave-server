import AuditLogModel, { AuditAction } from "../models/auditLog.model";

/**
 * Writes an audit log entry. Never throws — a logging failure should
 * not roll back or block the underlying admin action.
 */
export const recordAuditLog = async (params: {
  action: AuditAction | string;
  performedBy: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, any>;
}) => {
  try {
    await AuditLogModel.create({
      action: params.action,
      performedBy: params.performedBy,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata || {},
    });
  } catch (err) {
    console.error("AUDIT LOG WRITE FAILED:", err);
  }
};