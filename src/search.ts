import manifest from "../plugin.json";
import { declaredTool } from "@modera/plugin-sdk";
import type {
  ToolDefinition,
  PluginUiContribution,
} from "@modera/plugin-sdk";
import { z } from "zod";
import { invalidResult, readResult, partialResult } from "./result-view";
const resultSchema = z.object({
  query: z.string().max(500),
  engine: z.enum(["bing", "duckduckgo"]),
  status: z.enum(["ok", "no_results", "challenge", "layout_changed"]),
  results: z
    .array(
      z.object({
        title: z.string().max(300),
        url: z
          .string()
          .max(4000)
          .refine((value) => {
            try {
              const url = new URL(value);
              return (
                ["http:", "https:"].includes(url.protocol) &&
                !url.username &&
                !url.password
              );
            } catch {
              return false;
            }
          }),
        snippet: z.string().max(1200),
        source: z.string(),
        icon: z.string().max(20_000).optional(),
      }),
    )
    .max(10),
});
export const searchDefinition = declaredTool(manifest, "web_search");
export const searchUi: PluginUiContribution = {
  id: "modera.websearch.search-result",
  slot: "tool.result",
  toolNames: [searchDefinition.id],
  requiredPermissions: [],
  async render(request) {
    const zh = request.locale.startsWith("zh");
    const title = zh ? "网络搜索" : "Web search";
    const parsed = readResult(request.tool?.result, title, zh, {
      label: zh ? "正在搜索网页…" : "Searching the web…",
      description: zh
        ? "正在查找并整理与查询相关的结果"
        : "Finding and organizing relevant results",
    });
    if (parsed.view) return parsed.view;
    const validated = resultSchema.safeParse(parsed.value);
    if (!validated.success)
      return parsed.partial
        ? partialResult(title, parsed.value, zh)
        : invalidResult(title, zh);
    const result = validated.data;
    const input = request.tool?.input as { maxResults?: number } | undefined;
    const statuses = zh
      ? {
          no_results: "没有找到结果",
          challenge: "搜索引擎要求验证，已停止",
          layout_changed: "无法识别搜索页面结构，未返回结果",
          ok: "",
        }
      : {
          no_results: "No results",
          challenge: "Verification required; stopped",
          layout_changed: "Unrecognized search page layout",
          ok: "",
        };
    return {
      title: result.query,
      header: false,
      scroll: true,
      badge: `${result.engine} · ${result.results.length}${parsed.partial ? (zh ? " · 部分结果" : " · Partial") : ""}`,
      children:
        result.status === "ok"
          ? [
              ...(parsed.partial
                ? [
                    {
                      type: "text" as const,
                      text: zh
                        ? "当前展示部分结果，完整内容可继续读取。"
                        : "Partial preview; more content is available through the result reference.",
                      tone: "muted" as const,
                    },
                  ]
                : []),
              {
                type: "result-list" as const,
                query: result.query,
                queryLabel: zh ? "查询" : "Query",
                limitLabel: `${zh ? "结果上限" : "Limit"}: ${input?.maxResults ?? 5}`,
                countLabel: zh ? "条结果" : "results",
                items: result.results.map((item) => ({
                  title: item.title,
                  url: item.url,
                  description: item.snippet,
                  ...(item.icon ? { icon: item.icon } : {}),
                })),
              },
            ]
          : [{ type: "text", text: statuses[result.status], tone: "muted" }],
    };
  },
};
