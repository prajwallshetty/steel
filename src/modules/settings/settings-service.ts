import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import type { AppSettings } from "@/types/settings";

/**
 * Master settings.
 *
 * Resolution is branch-first: a branch row overrides the global row, and the
 * global row overrides the compiled-in defaults. Merging over the defaults on
 * read means a settings document written by an older release gains new keys
 * instead of surfacing `undefined` deep inside the pricing engine.
 *
 * Settings are defaults for *future* quotations. Saved quotations carry their
 * own rates on every row and are never recalculated against them.
 */

function merge(stored: Partial<AppSettings> | null): AppSettings {
  if (!stored) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    display: { ...DEFAULT_SETTINGS.display, ...stored.display },
    pricing: { ...DEFAULT_SETTINGS.pricing, ...stored.pricing },
  };
}

/** Effective settings for a branch (or the global row when `branchId` is null). */
export async function getSettings(
  branchId?: string | null,
): Promise<AppSettings> {
  const [branchRow, globalRow] = await Promise.all([
    branchId
      ? prisma.systemSetting.findUnique({ where: { branchId } })
      : Promise.resolve(null),
    prisma.systemSetting.findFirst({ where: { branchId: null } }),
  ]);

  const source = branchRow ?? globalRow;
  return merge(source?.data as Partial<AppSettings> | null);
}

export async function saveSettings(
  input: Omit<AppSettings, "updatedAt">,
  updatedById: string,
  branchId: string | null = null,
): Promise<AppSettings> {
  const data = { ...input, updatedAt: new Date().toISOString() };

  if (branchId) {
    await prisma.systemSetting.upsert({
      where: { branchId },
      create: { branchId, data: data as unknown as Prisma.InputJsonValue, updatedById },
      update: { data: data as unknown as Prisma.InputJsonValue, updatedById },
    });
    return data;
  }

  // The global row has a null branchId, which a unique constraint cannot key
  // on, so it is located by query rather than upserted by id.
  const existing = await prisma.systemSetting.findFirst({
    where: { branchId: null },
  });

  if (existing) {
    await prisma.systemSetting.update({
      where: { id: existing.id },
      data: { data: data as unknown as Prisma.InputJsonValue, updatedById },
    });
  } else {
    await prisma.systemSetting.create({
      data: {
        branchId: null,
        data: data as unknown as Prisma.InputJsonValue,
        updatedById,
      },
    });
  }

  return data;
}
