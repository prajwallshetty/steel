import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";

/**
 * Per-branch, per-year reference numbering.
 *
 * Allocation is a single atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`.
 * Read-then-write in application code would let two concurrent saves observe the
 * same counter and mint duplicate references; letting Postgres do the increment
 * removes the race entirely, without an explicit lock or a retry loop.
 */

export type SequenceKind = "QUOTATION" | "LEDGER";

export async function nextSequenceValue(
  branchId: string,
  kind: SequenceKind,
  year: number,
  tx?: Prisma.TransactionClient,
): Promise<number> {
  const client = tx ?? prisma;

  const rows = await client.$queryRaw<{ value: number }[]>`
    INSERT INTO "sequences" ("id", "branchId", "kind", "year", "value")
    VALUES (${randomUUID()}, ${branchId}, ${kind}, ${year}, 1)
    ON CONFLICT ("branchId", "kind", "year")
    DO UPDATE SET "value" = "sequences"."value" + 1
    RETURNING "value"
  `;

  const value = rows[0]?.value;
  if (typeof value !== "number") {
    throw new Error(`Failed to allocate a ${kind} number.`);
  }
  return value;
}

/** `MNG/QT/2026/0007` — branch code, document kind, year, zero-padded serial. */
export function formatReference(
  branchCode: string,
  kind: SequenceKind,
  year: number,
  value: number,
): string {
  const token = kind === "QUOTATION" ? "QT" : "LDG";
  return `${branchCode}/${token}/${year}/${String(value).padStart(4, "0")}`;
}
