import "server-only";
import { headers } from "next/headers";
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { clientIp } from "@/modules/auth/session";

/**
 * Audit trail.
 *
 * Every mutation records who did what, when, from where, and what changed.
 * Writes are best-effort: an audit failure must never roll back the business
 * operation the user actually asked for, so errors are logged rather than
 * propagated. When a transaction client is supplied the log is written inside
 * that transaction instead, which is what financial operations use so the entry
 * and its audit row commit or fail together.
 */

export interface AuditEntry {
  readonly action: AuditAction;
  readonly entity: string;
  readonly entityId?: string | null;
  readonly summary: string;
  readonly userId?: string | null;
  readonly branchId?: string | null;
  readonly oldValue?: unknown;
  readonly newValue?: unknown;
}

type TransactionClient = Prisma.TransactionClient;

export async function recordAudit(
  entry: AuditEntry,
  tx?: TransactionClient,
): Promise<void> {
  const client = tx ?? prisma;

  try {
    const requestHeaders = await headers().catch(() => null);

    await client.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        summary: entry.summary,
        userId: entry.userId ?? null,
        branchId: entry.branchId ?? null,
        oldValue: toJson(entry.oldValue),
        newValue: toJson(entry.newValue),
        ipAddress: requestHeaders ? clientIp(requestHeaders) : null,
        userAgent: requestHeaders?.get("user-agent")?.slice(0, 512) ?? null,
      },
    });
  } catch (error) {
    if (tx) throw error; // Inside a transaction the caller decides.
    console.error("[audit] failed to record entry", entry.entity, error);
  }
}

/**
 * Reduce an object to the fields that actually changed.
 *
 * Storing whole rows makes the audit screen unreadable and silently captures
 * secrets; a diff of the touched fields is what an auditor wants to see.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  ignore: readonly string[] = ["updatedAt", "passwordHash"],
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  for (const [key, next] of Object.entries(after)) {
    if (ignore.includes(key)) continue;
    const previous = before[key];
    if (!Object.is(normalise(previous), normalise(next))) {
      changedBefore[key] = normalise(previous);
      changedAfter[key] = normalise(next);
    }
  }

  return Object.keys(changedAfter).length > 0
    ? { before: changedBefore, after: changedAfter }
    : null;
}

const normalise = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toString" in value) {
    // Prisma Decimal and similar wrappers compare poorly by reference.
    const primitive = value.toString();
    if (/^-?\d+(\.\d+)?$/.test(primitive)) return primitive;
  }
  return value;
};

const toJson = (value: unknown): Prisma.InputJsonValue | undefined =>
  value === undefined ? undefined : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);
