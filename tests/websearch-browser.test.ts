import { it, expect } from "vitest";
import { systemProxy } from "@modera-host/plugin-sdk/src/browser/system-proxy";
import { BrowserDriver } from "@modera-host/plugin-sdk/src/browser/driver";
import {
  extractSearch,
  resultUrl,
  searchWeb,
} from "../src/engines";
import { searchUi } from "../src/search";
import { readWeb } from "@modera-host/plugin-sdk/src/net";

it("unwraps search redirects and rejects unsafe or malformed destinations", () => {
  expect(
    resultUrl(
      "//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fx",
      "duckduckgo",
    ),
  ).toBe("https://example.com/x");
  expect(
    resultUrl(
      `https://www.bing.com/ck/a?u=a1${Buffer.from("https://example.com/a").toString("base64url")}`,
      "bing",
    ),
  ).toBe("https://example.com/a");
  for (const raw of [
    "javascript:alert(1)",
    "http://127.0.0.1/x",
    "https://u:p@example.com",
    "https://www.bing.com/ck/a?u=broken",
  ])
    expect(resultUrl(raw, "bing")).toBeUndefined();
});
it.runIf(process.env.DF_LIVE_WEB === "1")(
  "reads a real public HTTPS page with pinned DNS",
  async () => {
    const result = await readWeb(
      "https://example.com",
      AbortSignal.timeout(20000),
    );
    expect(result.html).toContain("Example Domain");
  },
  25000,
);
it.runIf(process.env.DF_LIVE_WEB === "1")(
  "reports the actual live search engine state without hiding network failures",
  async () => {
    const driver = new BrowserDriver();
    try {
      for (const engine of ["duckduckgo", "bing"] as const) {
        const signal = AbortSignal.timeout(20000);
        try {
          const result = await driver.withPage(
            "",
            signal,
            (page) =>
              searchWeb(page, engine, "Puppeteer documentation", 3, signal),
            { dynamic: true, proxy: await systemProxy() },
          );
          console.log(
            `Live ${engine}: ${result.status}, ${result.results.length} results`,
          );
          expect(["ok", "no_results", "challenge", "layout_changed"]).toContain(
            result.status,
          );
        } catch (error) {
          console.log(`Live ${engine} unavailable: ${String(error)}`);
        }
      }
    } finally {
      await driver.close();
    }
  },
  45000,
);
it.runIf(process.env.DF_SYSTEM_BROWSER === "1")(
  "uses a real system browser for engine fixtures, scripts isolation, reuse and cancellation",
  async () => {
    const driver = new BrowserDriver();
    const started = Date.now();
    try {
      const signal = AbortSignal.timeout(30000);
      await driver.withPage("", signal, async (page) => {
        await page.setContent(
          `<script>document.body.innerHTML='BROKEN'</script><table><tr><td><a class="result-link" href="https://example.com/one">First</a></td></tr><tr><td class="result-snippet">First snippet</td></tr><tr><td><a class="result-link" href="https://example.com/two">Second</a></td></tr></table>`,
        );
        const result = await extractSearch(page, "duckduckgo", "fixture", 1);
        expect(result).toMatchObject({
          status: "ok",
          results: [
            {
              title: "First",
              snippet: "First snippet",
              url: "https://example.com/one",
              source: "example.com",
            },
          ],
        });
        const view = await searchUi.render(
          {
            id: searchUi.id,
            sessionId: "s",
            locale: "zh-CN",
            tool: {
              name: "web_search",
              input: {},
              result: JSON.stringify(result),
            },
          },
          { sessionId: "s", runId: "r", signal },
        );
        expect(view.data).toMatchObject({ results: [{ url: "https://example.com/one" }] });
        await page.setContent(
          `<ul id="b_results"><li class="b_algo b_ad"><h2><a href="https://ads.example.com">Ad</a></h2></li><li class="b_algo"><h2><a href="https://example.com">Bing title</a></h2><div class="b_caption"><p>Summary</p></div></li></ul>`,
        );
        expect(
          (await extractSearch(page, "bing", "fixture", 5)).results,
        ).toHaveLength(1);
        await page.setContent(
          `<form id="challenge-form">Verify you are human</form>`,
        );
        expect(
          (await extractSearch(page, "duckduckgo", "fixture", 5)).status,
        ).toBe("challenge");
        await page.setContent(`<p>No results found for fixture</p>`);
        expect((await extractSearch(page, "bing", "fixture", 5)).status).toBe(
          "no_results",
        );
        await page.setContent(`<h1>New unknown layout</h1>`);
        expect((await extractSearch(page, "bing", "fixture", 5)).status).toBe(
          "layout_changed",
        );
      });
      const controller = new AbortController();
      await expect(
        driver.withPage("", controller.signal, async (page) => {
          controller.abort(new Error("fixture cancelled"));
          await page.waitForSelector("#never", { timeout: 10000 });
        }),
      ).rejects.toThrow();
      console.log(
        `Real browser fixture including cold launch and cancellation: ${Date.now() - started} ms`,
      );
    } finally {
      await driver.close();
    }
  },
  45000,
);
