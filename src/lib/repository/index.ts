import { FileQuotationRepository } from "./file-quotation-repository";
import { FileSettingsRepository } from "./file-settings-repository";
import type { QuotationRepository, SettingsRepository } from "./types";

/**
 * Composition root for persistence.
 *
 * Instances are cached on `globalThis` so Next's dev-mode module reloading does
 * not spawn a second store — which would break the write serialisation the
 * JSON store relies on.
 */
const globalStore = globalThis as typeof globalThis & {
  __steelQuotations?: QuotationRepository;
  __steelSettings?: SettingsRepository;
};

export const quotationRepository: QuotationRepository =
  globalStore.__steelQuotations ??
  (globalStore.__steelQuotations = new FileQuotationRepository());

export const settingsRepository: SettingsRepository =
  globalStore.__steelSettings ??
  (globalStore.__steelSettings = new FileSettingsRepository());

export { ConflictError, NotFoundError } from "./types";
export type { QuotationRepository, SettingsRepository } from "./types";
