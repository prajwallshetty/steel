import type { Quotation, QuotationDraft } from "@/types/quotation";
import type { AppSettings } from "@/types/settings";

/**
 * Persistence contracts. The app depends on these interfaces only, never on a
 * concrete store, so the JSON implementation can be replaced with Prisma or a
 * REST backend without touching a route, action or component.
 */

export interface QuotationRepository {
  list(): Promise<Quotation[]>;
  findById(id: string): Promise<Quotation | null>;
  create(draft: QuotationDraft, createdBy: string): Promise<Quotation>;
  update(id: string, draft: QuotationDraft): Promise<Quotation>;
  remove(id: string): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<AppSettings>;
  save(settings: Omit<AppSettings, "updatedAt">): Promise<AppSettings>;
}

/** Thrown when an id does not resolve — mapped to a 404 by callers. */
export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} "${id}" was not found`);
    this.name = "NotFoundError";
  }
}

/** Thrown when a write is rejected by a business rule — mapped to a 409. */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
