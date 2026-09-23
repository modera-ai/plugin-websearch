import { appendFile, mkdir, readFile, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
export type Trace = (phase: string, details?: Record<string, unknown>) => void;
export class SearchDiagnostics {
  readonly path: string;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private root: string) {
    this.path = join(root, "websearch.log");
  }
  operation(kind: string): Trace {
    const id = randomUUID().slice(0, 8),
      start = Date.now();
    return (phase, details = {}) => {
      const line = JSON.stringify({
        time: new Date().toISOString(),
        id,
        kind,
        phase,
        elapsedMs: Date.now() - start,
        ...details,
      });
      console.info(`[WebSearch] ${line}`);
      this.queue = this.queue
        .then(async () => {
          await mkdir(this.root, { recursive: true });
          const size = await stat(this.path).then(
            (info) => info.size,
            () => 0,
          );
          if (size > 1024 * 1024)
            await rename(this.path, this.path + ".previous").catch(() => {});
          await appendFile(this.path, line + "\n", "utf8");
        })
        .catch((error) =>
          console.warn("[WebSearch] diagnostic write failed", String(error)),
        );
    };
  }
  async read() {
    await this.queue;
    return {
      path: this.path,
      text: await readFile(this.path, "utf8").then(
        (text) => text.slice(-20000),
        () => "",
      ),
    };
  }
}
