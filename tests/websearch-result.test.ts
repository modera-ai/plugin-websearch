import { it, expect } from "vitest";
import { searchUi } from "../src/search";
import { fetchUi } from "../src/fetch-ui";
import { settings } from "../src/config";
const context = {
  sessionId: "s",
  runId: "r",
  signal: new AbortController().signal,
};
it.each([searchUi, fetchUi])(
  "renders pending, failed, truncated and malformed $id results without throwing",
  async (ui) => {
    const render = (raw?: string) =>
      ui.render(
        {
          id: ui.id,
          sessionId: "s",
          locale: "zh-CN",
          tool: {
            name: ui.toolNames![0]!,
            input: {},
            ...(raw === undefined ? {} : { result: raw }),
          },
        },
        context,
      );
    expect(await render()).toMatchObject({
      live: true,
      children: [{ type: "progress", label: expect.stringContaining("正在") }],
    });
    expect(
      (await render('{"error":"connect ETIMEDOUT"}')).children,
    ).toMatchObject([{ text: "connect ETIMEDOUT" }]);
    expect(
      (await render('{"truncated":true,"preview":"partial"}')).children,
    ).toMatchObject([{ text: expect.stringContaining("预览") }]);
    for (const raw of [
      "null",
      "[]",
      "{}",
      "not-json",
      '{"results":null}',
      '{"title":"x","url":"file:///secret","text":"secret","truncated":false}',
    ]) {
      expect((await render(raw)).children).toMatchObject([
        { text: expect.stringContaining("格式无法识别") },
      ]);
    }
  },
);
it("defaults to Bing without overriding an explicit engine choice", async () => {
  const host = {
    pluginId: "test",
    storagePath: "",
    signal: context.signal,
    grantedPermissions: new Set<never>(),
  };
  expect((await settings(host)).engine).toBe("bing");
  expect(
    (
      await settings({
        ...host,
        config: {
          read: async () => ({
            revision: 1,
            values: { searchEngine: "duckduckgo" },
            overrides: {},
            inherited: {},
            sources: {},
          }),
        },
      })
    ).engine,
  ).toBe("duckduckgo");
});
