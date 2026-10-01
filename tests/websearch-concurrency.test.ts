import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ started: [] as number[], release: [] as (() => void)[], closed: [] as number[] }));
vi.mock("@modera/plugin-sdk/browser", () => ({
  scanBrowsers: vi.fn(),
  BrowserDriver: class {
    id = state.release.length;
    gate = new Promise<void>(resolve => { state.release.push(resolve); });
    async withPage() { state.started.push(this.id); await this.gate; return { text: "page" }; }
    async close() { state.closed.push(this.id); }
  },
}));
vi.mock("../src/config", () => ({ config: {}, settings: async () => ({ timeoutMs: 30000, blocked: [] }) }));
vi.mock("../src/diagnostics", () => ({ SearchDiagnostics: class { operation() { return () => {}; } } }));
import { activate, deactivate } from "../src/index";

it("runs four webpage reads on separate browser lanes and closes every lane", async () => {
  const contributions = await activate({
    pluginId: "modera.websearch", storagePath: "unused",
    grantedPermissions: new Set(), signal: new AbortController().signal,
  });
  const fetch = contributions!.tools!.find(tool => tool.definition.id === "web_fetch")!;
  expect(fetch.definition.concurrency).toBe("independent-read");
  const work = Array.from({ length: 4 }, (_, index) => fetch.execute(
    { url: `https://example.com/${index}` },
    { sessionId: "s", runId: "r", signal: new AbortController().signal },
  ));
  try {
    await vi.waitFor(() => expect(state.started).toEqual([0, 1, 2, 3]));
  } finally {
    state.release.forEach(release => release());
    await Promise.all(work);
    await deactivate();
  }
  expect(state.closed.sort()).toEqual([0, 1, 2, 3]);
});
