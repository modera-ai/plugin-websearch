import React from "react";
import { AgentDocumentResult, AgentResultLink, AgentWebResults, ToolExecution, parseToolOutput } from "@modera/ui";
import type { PluginToolRendererProps } from "@modera/plugin-sdk";
type WebData = { kind?: string; pending?: boolean; message?: string; description?: string; preview?: string; query?: string; results?: Record<string, unknown>[]; engine?: string; partial?: boolean; limit?: number; url?: string; title?: string; text?: string; truncated?: boolean; characterLabel?: string };
export default function WebResult({ call, result, state, title, locale, open, onOpenChange, data, error }: PluginToolRendererProps) {
  const value = data as WebData | undefined;
  const t = (zh: string, en: string) => locale === "zh" ? zh : en;
  return <ToolExecution kind={call.name === "web_search" ? "search" : "web"} name={call.name} title={title} target={value?.query ?? value?.url} state={state} error={error} input={call.input} output={result ? parseToolOutput(result) : undefined} tone={call.name === "web_search" ? "blue" : "teal"} locale={locale} open={open} onOpenChange={onOpenChange}>
    {value ? <div className="mu-agent-tool-view">
      {value.message && <p role="status">{value.message}</p>}{value.description && <small>{value.description}</small>}
      {value.partial && <small>{t("当前展示部分结果，完整内容可通过结果引用继续读取。", "Partial preview; use the result reference to read more.")}</small>}
      {value.kind === "search" && <><small>{value.engine} · {t("结果上限", "Limit")}: {value.limit}</small><AgentWebResults items={value.results ?? []} query={value.query} queryLabel={t("查询", "Query")} countLabel={t("条结果", "results")} /></>}
      {value.kind === "document" && <><AgentResultLink href={value.url}>{value.title || value.url}</AgentResultLink><AgentDocumentResult label={t("内容预览", "Content preview")} meta={`${value.characterLabel} · ${value.truncated || value.partial ? t("内容已截断", "Truncated") : t("完整内容", "Complete")}`} value={value.text ?? ""} preview={value.text?.replace(/\s+/g, " ").trim().slice(0, 1200)} /></>}
      {value.preview && <AgentDocumentResult label={t("部分结果", "Partial result")} value={value.preview} />}
    </div> : null}
  </ToolExecution>;
}
