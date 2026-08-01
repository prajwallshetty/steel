import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * A small JSON-file store with serialised writes.
 *
 * Reads and writes for a given file are chained through a single promise so two
 * concurrent requests cannot interleave a read-modify-write and lose an update.
 * Writes go to a temp file and are renamed into place, so a crash mid-write
 * leaves the previous document intact rather than a truncated one.
 */
export class JsonFileStore<T> {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly seed: () => T,
  ) {}

  /** Run `mutator` with exclusive access to the document. */
  async transact<R>(mutator: (current: T) => Promise<R> | R): Promise<R> {
    const run = this.queue.then(async () => {
      const current = await this.readRaw();
      return mutator(current);
    });
    // Keep the chain alive even if this operation rejects.
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Read the document, seeding the file on first access. */
  async read(): Promise<T> {
    return this.transact((current) => current);
  }

  async write(next: T): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(next, null, 2), "utf8");
    await rename(temp, this.filePath);
  }

  private async readRaw(): Promise<T> {
    try {
      const contents = await readFile(this.filePath, "utf8");
      return JSON.parse(contents) as T;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        const seeded = this.seed();
        await this.write(seeded);
        return seeded;
      }
      throw error;
    }
  }
}

/** Where the JSON documents live. Overridable for tests and deployments. */
export const DATA_DIR =
  process.env.STEEL_DATA_DIR ?? path.join(process.cwd(), "data");
