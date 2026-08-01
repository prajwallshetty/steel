import path from "node:path";
import type { AppSettings } from "@/types/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { DATA_DIR, JsonFileStore } from "./json-file-store";
import type { SettingsRepository } from "./types";

/** JSON-backed implementation of {@link SettingsRepository}. */
export class FileSettingsRepository implements SettingsRepository {
  private readonly store: JsonFileStore<AppSettings>;

  constructor(filePath = path.join(DATA_DIR, "settings.json")) {
    this.store = new JsonFileStore<AppSettings>(filePath, () => DEFAULT_SETTINGS);
  }

  async get(): Promise<AppSettings> {
    const stored = await this.store.read();
    // Merge over the defaults so a settings file written by an older release
    // gains new keys instead of surfacing `undefined` deep in the engine.
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      display: { ...DEFAULT_SETTINGS.display, ...stored.display },
      pricing: { ...DEFAULT_SETTINGS.pricing, ...stored.pricing },
    };
  }

  async save(settings: Omit<AppSettings, "updatedAt">): Promise<AppSettings> {
    return this.store.transact(async () => {
      const next: AppSettings = {
        ...settings,
        updatedAt: new Date().toISOString(),
      };
      await this.store.write(next);
      return next;
    });
  }
}
