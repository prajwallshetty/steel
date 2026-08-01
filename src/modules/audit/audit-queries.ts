import "server-only";
import { AuditAction, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import type { ScopeSubject } from "@/modules/permissions/scope";

/**
 * Audit log reads.
 *
 * Scoped like everything else: a branch admin sees their branch's trail, a
 * Super Admin sees the organisation. The log is append-only — there is no
 * update or delete path anywhere in the codebase.
 */

export interface AuditFilters {
  readonly search?: string;
  readonly action?: AuditAction;
  readonly entity?: string;
  readonly branchId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly take?: number;
}

export interface AuditRow {
  readonly id: string;
  readonly action: AuditAction;
  readonly entity: string;
  readonly entityId: string | null;
  readonly summary: string;
  readonly userName: string;
  readonly branchName: string | null;
  readonly ipAddress: string | null;
  readonly createdAt: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
}

export async function listAuditLog(
  subject: ScopeSubject,
  filters: AuditFilters = {},
): Promise<AuditRow[]> {
  const conditions: Prisma.AuditLogWhereInput[] = [];

  if (subject.role !== Role.SUPER_ADMIN) {
    // Branch-scoped admins see their branch's events only.
    conditions.push({ branchId: subject.branchId ?? "__none__" });
  } else if (filters.branchId) {
    conditions.push({ branchId: filters.branchId });
  }

  if (filters.action) conditions.push({ action: filters.action });
  if (filters.entity) conditions.push({ entity: filters.entity });
  if (filters.from) conditions.push({ createdAt: { gte: new Date(filters.from) } });
  if (filters.to) {
    // Inclusive of the whole end day, not just midnight.
    const end = new Date(filters.to);
    end.setHours(23, 59, 59, 999);
    conditions.push({ createdAt: { lte: end } });
  }
  if (filters.search?.trim()) {
    const term = filters.search.trim();
    conditions.push({
      OR: [
        { summary: { contains: term, mode: "insensitive" } },
        { entity: { contains: term, mode: "insensitive" } },
        { user: { name: { contains: term, mode: "insensitive" } } },
      ],
    });
  }

  const rows = await prisma.auditLog.findMany({
    where: conditions.length > 0 ? { AND: conditions } : {},
    orderBy: { createdAt: "desc" },
    take: filters.take ?? 200,
    include: {
      user: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    summary: row.summary,
    userName: row.user?.name ?? "System",
    branchName: row.branch?.name ?? null,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt.toISOString(),
    oldValue: row.oldValue,
    newValue: row.newValue,
  }));
}

/** Distinct entity names present in the log, for the filter dropdown. */
export async function listAuditEntities(
  subject: ScopeSubject,
): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    where:
      subject.role === Role.SUPER_ADMIN
        ? {}
        : { branchId: subject.branchId ?? "__none__" },
    distinct: ["entity"],
    select: { entity: true },
    orderBy: { entity: "asc" },
  });
  return rows.map((row) => row.entity);
}
