import { expect, it } from "vitest";
import { resolveModelBudget } from "@modera/model-catalog";
import { AgentLoop } from "../../default-agent/src/agent-loop";
import { ToolRegistry, ToolExecutor } from "@modera/agent-host";
import type { RunId, SessionId } from "@modera/contracts";
import { searchUi } from "../src/search";
import { serializeToolResult } from "@modera-host/agent-host/src/tool-result";

it("uses exact official presets, respects model overrides and does not guess relay capacity", () => {
  expect(
    resolveModelBudget(
      { baseUrl: "https://api.deepseek.com", contextInputBudget: 48000 },
      "deepseek-reasoner",
    ).inputBudget,
  ).toBe(88832);
  expect(
    resolveModelBudget(
      { baseUrl: "https://relay.example" },
      "deepseek-reasoner",
    ).inputBudget,
  ).toBe(48000);
  expect(
    resolveModelBudget(
      {
        modelBudgets: {
          m: { contextWindowTokens: 128000, maxOutputTokens: 16000 },
        },
      },
      "m",
    ).inputBudget,
  ).toBe(105600);
  expect(
    resolveModelBudget(
      {
        baseUrl: "https://api.deepseek.com",
        modelBudgets: { "deepseek-reasoner": { contextInputBudget: 24000 } },
      },
      "deepseek-reasoner",
    ).inputBudget,
  ).toBe(24000);
});

it("reports per-request context and captures reasoning separately from cumulative usage", async () => {
  const loop = new AgentLoop({
    model: {
      async *stream() {
        yield { type: "thinking-delta" as const, text: "check" };
        yield { type: "text-delta" as const, text: "done" };
        yield {
          type: "completed" as const,
          usage: {
            inputTokens: 100,
            outputTokens: 20,
            reasoningTokens: 5,
            cacheReadTokens: 70,
          },
        };
      },
    },
  });
  const events = [];
  for await (const event of loop.run({
    runId: "r" as RunId,
    sessionId: "s" as SessionId,
    messages: [],
    tools: [],
    signal: new AbortController().signal,
  }))
    events.push(event);
  expect(events.filter((e) => e.type === "context-usage")).toHaveLength(2);
  expect(events.at(-1)).toMatchObject({
    type: "completed",
    reasoning: { tokens: 5, estimated: false },
    usage: { inputTokens: 100 },
  });
});

it("renders oversized search evidence as partial content instead of a search error", async () => {
  const raw = serializeToolResult({
    query: "topic",
    engine: "bing",
    status: "ok",
    results: Array.from({ length: 10 }, (_, i) => ({
      title: `Result ${i}`,
      url: `https://example.com/${i}`,
      source: "example.com",
      snippet: "evidence ".repeat(150),
      icon: "x".repeat(10000),
    })),
  });
  const view = await searchUi.render(
    {
      id: searchUi.id,
      sessionId: "s",
      locale: "zh-CN",
      tool: { name: "web_search", input: {}, result: raw },
    },
    { sessionId: "s", runId: "r", signal: new AbortController().signal },
  );
  expect(view.data).toMatchObject({ partial: true, kind: "search" });
  expect(JSON.stringify(view)).not.toContain("大小限制");
  expect(JSON.stringify(view)).toContain("example.com");
});

it("persists distinct reasoning counters on every tool round without double-counting run metrics", async () => {
  const registry = new ToolRegistry();
  registry.register("fixture", {
    definition: {
      id: "read",
      title: "Read",
      description: "",
      inputSchema: {},
      requiredPermissions: [],
    },
    execute: async () => ({ ok: true }),
  });
  let round = 0;
  const loop = new AgentLoop({
    executor: new ToolExecutor(registry, async () => true),
    model: {
      async *stream() {
        round++;
        yield { type: "thinking-delta" as const, text: `round ${round}` };
        if (round < 3)
          yield {
            type: "tool-call" as const,
            id: `call${round}`,
            name: "read",
            input: {},
          };
        else yield { type: "text-delta" as const, text: "done" };
        yield {
          type: "completed" as const,
          usage: {
            inputTokens: 100,
            outputTokens: 20,
            reasoningTokens: round * 2,
          },
        };
      },
    },
  });
  const events = [];
  for await (const e of loop.run({
    runId: "r" as RunId,
    sessionId: "s" as SessionId,
    messages: [],
    tools: [],
    signal: new AbortController().signal,
  }))
    events.push(e);
  const thoughts = events.flatMap((e) =>
    e.type === "messages"
      ? e.messages.filter((m) => m.role === "assistant")
      : [],
  );
  expect(thoughts.map((m) => m.reasoning?.tokens)).toEqual([2, 4]);
  expect(thoughts.every((m) => !m.metrics)).toBe(true);
  expect(events.at(-1)).toMatchObject({
    reasoning: { tokens: 6 },
    usage: { inputTokens: 300, outputTokens: 60 },
  });
});
