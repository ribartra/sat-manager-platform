import prisma from "@/lib/prisma";

/**
 * Audit log retention (RNF-12): entries older than 12 months are deleted. Runs with the hourly
 * internal maintenance call; deleting by createdAt uses the AuditLog(createdAt) index.
 */
export const AUDIT_RETENTION_DAYS = 365;

export async function pruneAuditLog(now = new Date()) {
  const cutoff = new Date(now.getTime() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}
