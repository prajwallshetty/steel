import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Quotation, QuotationDraft } from "@/types/quotation";
import { DATA_DIR, JsonFileStore } from "./json-file-store";
import { REFERENCE_QUOTATION } from "./seed-quotation";
import {
  ConflictError,
  NotFoundError,
  type QuotationRepository,
} from "./types";

interface QuotationDocument {
  quotations: Quotation[];
}

const REFERENCE_PREFIX = "QT";

/** JSON-backed implementation of {@link QuotationRepository}. */
export class FileQuotationRepository implements QuotationRepository {
  private readonly store: JsonFileStore<QuotationDocument>;

  constructor(filePath = path.join(DATA_DIR, "quotations.json")) {
    this.store = new JsonFileStore<QuotationDocument>(filePath, () => ({
      quotations: [REFERENCE_QUOTATION],
    }));
  }

  async list(): Promise<Quotation[]> {
    const { quotations } = await this.store.read();
    return [...quotations].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  async findById(id: string): Promise<Quotation | null> {
    const { quotations } = await this.store.read();
    return quotations.find((quotation) => quotation.id === id) ?? null;
  }

  async create(draft: QuotationDraft, createdBy: string): Promise<Quotation> {
    return this.store.transact(async (document) => {
      const now = new Date().toISOString();
      const created: Quotation = {
        id: randomUUID(),
        reference: nextReference(document.quotations, draft.header.date),
        status: draft.status,
        header: draft.header,
        rows: draft.rows,
        remarks: draft.remarks,
        createdBy,
        createdAt: now,
        updatedAt: now,
      };
      await this.store.write({
        quotations: [...document.quotations, created],
      });
      return created;
    });
  }

  async update(id: string, draft: QuotationDraft): Promise<Quotation> {
    return this.store.transact(async (document) => {
      const index = document.quotations.findIndex(
        (quotation) => quotation.id === id,
      );
      if (index === -1) throw new NotFoundError("Quotation", id);

      const existing = document.quotations[index];
      if (existing.status === "finalized") {
        // Finalized quotations are the record of a commitment already made.
        throw new ConflictError(
          "This quotation is finalized and can no longer be edited. Duplicate it to make changes.",
        );
      }

      const updated: Quotation = {
        ...existing,
        status: draft.status,
        header: draft.header,
        rows: draft.rows,
        remarks: draft.remarks,
        updatedAt: new Date().toISOString(),
      };

      const quotations = [...document.quotations];
      quotations[index] = updated;
      await this.store.write({ quotations });
      return updated;
    });
  }

  async remove(id: string): Promise<void> {
    await this.store.transact(async (document) => {
      const quotations = document.quotations.filter(
        (quotation) => quotation.id !== id,
      );
      if (quotations.length === document.quotations.length) {
        throw new NotFoundError("Quotation", id);
      }
      await this.store.write({ quotations });
    });
  }
}

/** `QT-2026-0007` — sequential within the quotation's calendar year. */
function nextReference(existing: readonly Quotation[], date: string): string {
  const year = date.slice(0, 4);
  const prefix = `${REFERENCE_PREFIX}-${year}-`;
  const highest = existing
    .map((quotation) => quotation.reference)
    .filter((reference) => reference.startsWith(prefix))
    .map((reference) => Number.parseInt(reference.slice(prefix.length), 10))
    .filter(Number.isFinite)
    .reduce((max, value) => Math.max(max, value), 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}
