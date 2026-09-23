import { systemProxy } from "@modera/plugin-sdk/browser";
import type { PluginConfigField, PluginContext } from "@modera/plugin-sdk";
export const config: Record<string, PluginConfigField> = {
  proxyEnabled: {
    type: "boolean",
    title: "Custom HTTP proxy",
    default: false,
    description: "When disabled, use the system proxy. Enable to override it.",
    locales: {
      "zh-CN": {
        title: "自定义 HTTP 代理",
        description: "关闭时继承系统代理，开启后使用下方地址。",
      },
    },
  },
  proxyUrl: {
    type: "string",
    title: "HTTP proxy URL",
    default: "http://127.0.0.1:7890",
    maxLength: 2000,
    locales: { "zh-CN": { title: "HTTP 代理地址" } },
  },
  blockedSites: {
    type: "string",
    title: "Blocked hosts (one per line)",
    default: "",
    maxLength: 4000,
    locales: { "zh-CN": { title: "屏蔽域名（每行一个，包含子域名）" } },
  },
  searchEngine: {
    type: "enum",
    title: "Search engine",
    default: "bing",
    description:
      "Bing is the default. If an engine is unreachable, select another engine here.",
    options: ["duckduckgo", "bing"],
    locales: {
      "zh-CN": {
        title: "搜索引擎",
        description:
          "默认使用 Bing。若引擎连接超时，可在这里切换；不会自动切换你明确选择的引擎。",
      },
    },
  },
  browserPath: {
    type: "string",
    title: "System browser executable",
    default: "",
    maxLength: 2000,
    description:
      "Leave empty to check known Chrome/Edge locations. Automation is headless; the sidebar uses a separate built-in browser.",
    locales: {
      "zh-CN": {
        title: "系统浏览器程序路径",
        description:
          "留空检查常见 Chrome/Edge 安装位置，或填写完整程序路径。搜索在后台运行；侧栏预览是独立的内置浏览器页面。",
      },
    },
  },
  timeoutSeconds: {
    type: "number",
    title: "Operation timeout (seconds)",
    default: 30,
    minimum: 5,
    maximum: 60,
    locales: { "zh-CN": { title: "操作超时（秒）" } },
  },
};
export async function settings(host: PluginContext, projectId?: string) {
  const values = (await host.config?.read(projectId))?.values ?? {};
  if (values.proxyEnabled && !String(values.proxyUrl ?? "").trim())
    throw new Error("HTTP proxy URL is required when proxy is enabled");
  return {
    engine:
      values.searchEngine === "duckduckgo"
        ? ("duckduckgo" as const)
        : ("bing" as const),
    browserPath: String(values.browserPath ?? ""),
    proxy: values.proxyEnabled
      ? String(values.proxyUrl ?? "")
      : await systemProxy(),
    proxySource: values.proxyEnabled ? "custom" : "system",
    blocked: String(values.blockedSites ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((host) => {
        if (!/^[a-z0-9.-]+$/i.test(host))
          throw new Error("Invalid blocked host");
        return new RegExp(
          `^https?://([^/]+\\.)?${host.replaceAll(".", "\\.")}(:[0-9]+)?(/|$)`,
          "i",
        );
      }),
    timeoutMs: Number(values.timeoutSeconds ?? 30) * 1000,
  };
}
