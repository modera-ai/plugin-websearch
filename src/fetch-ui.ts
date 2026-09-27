import { z } from "zod";
import type { PluginUiContribution } from "@modera/plugin-sdk";
import { invalidResult, readResult, partialResult } from "./result-view";
import { fetchDefinition } from "./fetch";
const schema = z.object({
  title: z.string().max(500),
  url: z.string().url().max(4000),
  text: z.string(),
  truncated: z.boolean(),
  icon: z.string().max(20_000).optional(),
});
export const fetchUi: PluginUiContribution = {
  id: "modera.websearch.fetch-result",
  slot: "tool.result",
  hostRenderer: "web-result",
  toolNames: [fetchDefinition.id],
  requiredPermissions: [],
  async render(request) {
    const zh = request.locale.startsWith("zh");
    const title = zh ? "网页读取" : "Read web page";
    const parsed = readResult(request.tool?.result, title, zh, {
      label: zh ? "正在读取网页…" : "Reading the page…",
      description: zh
        ? "正在提取标题、来源和正文内容"
        : "Extracting the title, source, and page content",
    });
    if (parsed.view) return parsed.view;
    const validated = schema.safeParse(parsed.value);
    if (!validated.success)
      return parsed.partial
        ? partialResult(title, parsed.value, zh)
        : invalidResult(title, zh);
    const result = validated.data;
    const url = new URL(result.url);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return invalidResult(title, zh);
    const characters = Array.from(result.text).length;
    const formattedCharacters = new Intl.NumberFormat(
      zh ? "zh-CN" : "en-US",
    ).format(characters);
    const characterLabel = `${formattedCharacters} ${zh ? "字符" : characters === 1 ? "character" : "characters"}`;
    return {
      title: result.title || url.hostname.replace(/^www\./, ""),
      data: { kind: "document", ...result, text: result.text.slice(0, 16000), partial: !!parsed.partial, characterLabel },
      children: [],
    };
  },
};
