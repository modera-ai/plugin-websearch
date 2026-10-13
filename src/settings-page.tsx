import { useEffect, useState } from "react";
import { FolderOpenIcon as FolderOpen } from "@phosphor-icons/react/dist/csr/FolderOpen";
import { GlobeIcon as Globe } from "@phosphor-icons/react/dist/csr/Globe";
import { ScanIcon as ScanSearch } from "@phosphor-icons/react/dist/csr/Scan";
import { Button, DialogNotice, Input, Select, Switch, Textarea, UiProvider } from "@modera/ui";
import { FieldRow, Form, FormItem, SettingsColumns, SettingsPage, SettingsPanel } from "@modera/ui/settings";
import { frontend, settingsAction, useSettings } from "@modera/plugin-sdk/react";
import { ChromeLogo, ChromiumLogo, EdgeLogo } from "./browser-logos";

export function SearchSettings() {
  const s = useSettings({ autoSave: true });
  const [browsers, setBrowsers] = useState<{ name: string; path: string }[]>([]);
  useEffect(() => { void frontend().ready().catch(() => {}); }, []);
  const t = (zh: string, en: string) => s.zh ? zh : en;
  const change = (key: string, value: string | number | boolean) => s.setValues((current) => ({ ...current, [key]: value }));
  return <UiProvider theme={s.snapshot?.theme?.mode ?? "system"} locale={s.zh ? "zh-CN" : "en"} className="search-settings-ui mu-settings-codex">
    <SettingsPage title={t("代理和搜索引擎", "Proxy and search engines")} description={t("配置网络连接与网页搜索，应用于所有项目。", "Configure network access and web search for all projects.")} actions={<span className="settings-save-feedback" role="status" aria-live="polite">{s.failed || s.error ? "" : s.message}</span>}>
      {!s.config ? <DialogNotice tone={s.error ? "error" : "default"}>{s.error || t("正在加载…", "Loading…")}</DialogNotice> : <>
        <SettingsColumns columns={1}>
          <SettingsPanel title={t("连接与搜索", "Connection and search")}>
            <Form columns={2}>
              <FormItem variant="inline" span="full" label={t("自定义 HTTP 代理", "Custom HTTP proxy")} description={t("关闭时自动继承系统代理", "Uses the system proxy when disabled")}><Switch label={t("自定义 HTTP 代理", "Custom HTTP proxy")} checked={!!s.values.proxyEnabled} onCheckedChange={(value) => change("proxyEnabled", value)} /></FormItem>
              <FormItem variant="inline" span="full" label={t("代理地址", "Proxy URL")}><Input label={t("代理地址", "Proxy URL")} hideLabel disabled={!s.values.proxyEnabled || s.busy} placeholder="http://127.0.0.1:7890" value={String(s.values.proxyUrl ?? "")} onChange={(value) => change("proxyUrl", value)} /></FormItem>
              <FormItem variant="inline" label={t("搜索引擎", "Search engine")}><Select label={t("搜索引擎", "Search engine")} value={String(s.values.searchEngine ?? "bing")} onValueChange={(value) => change("searchEngine", value)} options={[{ value: "bing", label: "Bing" }, { value: "duckduckgo", label: "DuckDuckGo" }]} /></FormItem>
              <FormItem variant="inline" label={t("搜索超时（秒）", "Search timeout (seconds)")}><Input label={t("搜索超时（秒）", "Search timeout (seconds)")} hideLabel type="number" min={5} max={60} value={Number(s.values.timeoutSeconds ?? 30)} onChange={(value) => { if (value !== "" && Number.isFinite(Number(value))) change("timeoutSeconds", Number(value)); }} /></FormItem>
            </Form>
          </SettingsPanel>
          <SettingsPanel title={t("浏览器执行环境", "Browser runtime")}>
            <Form><FormItem variant="inline" className="settings-path-row" label={t("浏览器路径", "Browser path")} description={t("留空自动检测 Chrome、Edge 或 Chromium。", "Leave empty to detect Chrome, Edge or Chromium.")}><FieldRow><Input label={t("浏览器可执行文件路径", "Browser executable path")} hideLabel placeholder={t("留空自动检测 Chrome / Edge / Chromium", "Leave empty to detect Chrome / Edge / Chromium")} value={String(s.values.browserPath ?? "")} onChange={(value) => change("browserPath", value)} /><Button variant="outline" disabled={s.busy} onClick={() => void s.run(async () => { const path = await frontend().settings.pickFile(); if (path) change("browserPath", path); })}><FolderOpen size={14} />{t("浏览", "Browse")}</Button></FieldRow></FormItem></Form>
            <Form><FormItem variant="inline" label={t("可用浏览器", "Available browsers")} description={t("检测本机已安装的浏览器。", "Find browsers installed on this computer.")}>            <Button variant="outline" disabled={s.busy} onClick={() => void s.run(async () => setBrowsers(await settingsAction("scanBrowsers")))}><ScanSearch size={14} />{t("检测可用浏览器", "Detect browsers")}</Button></FormItem></Form>
            {browsers.length > 0 && <div className="search-browser-list">{browsers.map((browser) => <div className="search-browser" key={browser.path}>
              {browser.name === "Microsoft Edge" ? <EdgeLogo size={24} /> : browser.name === "Google Chrome" ? <ChromeLogo size={24} /> : browser.name === "Chromium" ? <ChromiumLogo size={24} /> : <Globe size={24} />}
              <span><strong>{browser.name}</strong><small>{browser.path}</small></span>
              <Button variant="outline" size="small" disabled={s.busy || s.values.browserPath === browser.path} onClick={() => change("browserPath", browser.path)}>{s.values.browserPath === browser.path ? t("已选择", "Selected") : t("使用", "Use")}</Button>
            </div>)}</div>}
          </SettingsPanel>
        </SettingsColumns>
        <SettingsColumns columns={1} className="search-secondary-grid">
          <SettingsPanel title={t("搜索边界", "Search boundaries")}>
            <Form><FormItem variant="inline" className="settings-path-row search-blocked-hosts" label={t("屏蔽域名", "Blocked hosts")} description={t("匹配的站点不会出现在搜索结果中，也无法被抓取。", "Matching sites are excluded from results and cannot be fetched.")}><Textarea label={t("屏蔽域名", "Blocked hosts")} hideLabel rows={3} placeholder={t("每行一个域名，例如 example.com（包含子域名）", "One host per line, e.g. example.com (including subdomains)")} value={String(s.values.blockedSites ?? "")} onChange={(event) => change("blockedSites", event.target.value)} /></FormItem></Form>
          </SettingsPanel>

        </SettingsColumns>
      </>}
      {(s.error || s.failed) && s.config && <DialogNotice tone={s.failed || s.error ? "error" : "default"}>{s.error || s.message}</DialogNotice>}
    </SettingsPage>
  </UiProvider>;
}
