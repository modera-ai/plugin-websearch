import type { PluginManifest, PluginModule } from "@modera/plugin-sdk";
import { SearchDiagnostics } from "./diagnostics";
import { scanBrowsers } from "@modera/plugin-sdk/browser";
import { BrowserDriver } from "@modera/plugin-sdk/browser";
import { config, settings } from "./config";
import { fetchDefinition, fetchPage } from "./fetch";
import { searchDefinition, searchUi } from "./search";
import { searchWeb } from "./engines";
import { fetchUi } from "./fetch-ui";
let drivers: BrowserDriver[] = [];
export const activate: PluginModule["activate"] = async (host) => {
  const diagnostics = new SearchDiagnostics(host.storagePath);
  // Each driver serializes its own isolated contexts; separate lanes allow independent reads.
  const browsers = Array.from({ length: 4 }, () => new BrowserDriver());
  drivers = browsers;
  let nextBrowser = 0;
  const selectBrowser = () => browsers[nextBrowser++ % browsers.length]!;
  return {
    settings: {
      actions: ["scanBrowsers", "readDiagnostics"],
      async act(_action, context) {
        context.signal.throwIfAborted();
        if (_action.id === "readDiagnostics") return diagnostics.read();
        return scanBrowsers();
      },
    },
    tools: [
      {
        definition: searchDefinition,
        async execute(raw, context) {
          const input = raw as { query: string; maxResults?: number };
          if (!input.query.trim()) throw new Error("EMPTY_QUERY");
          const trace = diagnostics.operation("search");
          const options = await settings(host, context.projectId);
          trace("start", {
            engine: options.engine,
            proxyEnabled: !!options.proxy,
            proxySource: options.proxy ? options.proxySource : "direct",
            proxyAddress: options.proxy ? new URL(options.proxy).origin : null,
            timeoutMs: options.timeoutMs,
            scope: context.projectId ?? "global",
          });
          const signal = AbortSignal.any([
            context.signal,
            host.signal,
            AbortSignal.timeout(options.timeoutMs),
          ]);
          return selectBrowser()
            .withPage(
              options.browserPath,
              signal,
              (page) =>
                searchWeb(
                  page,
                  options.engine,
                  input.query.trim(),
                  input.maxResults ?? 5,
                  signal,
                  trace,
                ),
              {
                dynamic: true,
                proxy: options.proxy,
                blocked: options.blocked,
                trace,
              },
            )
            .then((result) => {
              trace("complete", {
                status: result.status,
                count: result.results.length,
              });
              const results = result.results.filter(
                (item) => !options.blocked.some((rule) => rule.test(item.url)),
              );
              return {
                ...result,
                results,
                status:
                  result.status === "ok" && !results.length
                    ? ("no_results" as const)
                    : result.status,
              };
            })
            .catch((cause: unknown) => {
              trace("failed", {
                error: String(cause),
                cancelled: context.signal.aborted,
                timeout: signal.aborted && !context.signal.aborted,
              });
              context.signal.throwIfAborted();
              host.signal.throwIfAborted();
              const detail = signal.aborted
                ? `Timed out after ${options.timeoutMs / 1000}s / 搜索超时`
                : cause instanceof Error
                  ? cause.message
                  : String(cause);
              throw new Error(
                `WEB_SEARCH_FAILED [${options.engine}]: ${detail}. Check the network or change Search engine in plugin settings / 请检查网络，或在插件配置中切换搜索引擎。`,
              );
            });
        },
      },
      {
        definition: fetchDefinition,
        async execute(raw, context) {
          const trace = diagnostics.operation("fetch");
          const options = await settings(host, context.projectId);
          trace("start", {
            proxyEnabled: !!options.proxy,
            proxySource: options.proxy ? options.proxySource : "direct",
            proxyAddress: options.proxy ? new URL(options.proxy).origin : null,
            timeoutMs: options.timeoutMs,
          });
          const signal = AbortSignal.any([
            context.signal,
            host.signal,
            AbortSignal.timeout(options.timeoutMs),
          ]);
          return selectBrowser()
            .withPage(
              options.browserPath,
              signal,
              (page) =>
                fetchPage(
                  page,
                  raw as { url: string; offset?: number; maxChars?: number },
                  signal,
                ),
              {
                dynamic: true,
                proxy: options.proxy,
                blocked: options.blocked,
                trace,
              },
            )
            .then((result) => {
              trace("complete", { characters: result.text.length });
              return result;
            })
            .catch((error) => {
              trace("failed", {
                error: String(error),
                cancelled: context.signal.aborted,
              });
              throw error;
            });
        },
      },
    ],
    ui: [searchUi, fetchUi],
  };
};
export const deactivate: PluginModule["deactivate"] = async () => {
  const current = drivers;
  drivers = [];
  await Promise.all(current.map(browser => browser.close()));
};
