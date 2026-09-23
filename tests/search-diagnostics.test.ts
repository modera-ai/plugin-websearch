import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SearchDiagnostics } from "../src/diagnostics";
it("correlates and persists diagnostic stages in order", async () => {
  const root = await mkdtemp(join(tmpdir(), "df-diagnostics-"));
  try {
    const logs = new SearchDiagnostics(root),
      trace = logs.operation("search");
    trace("start", { engine: "bing" });
    trace("failed", { error: "CONNECT_TIMEOUT" });
    const output = await logs.read();
    const entries = output.text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(entries.map((item) => item.phase)).toEqual(["start", "failed"]);
    expect(entries[0].id).toBe(entries[1].id);
    expect(output.path).toBe(join(root, "websearch.log"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
