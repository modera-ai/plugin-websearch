import { useEffect, useState } from "react";
import { FileTextIcon as FileText } from "@phosphor-icons/react/dist/csr/FileText";
import { FolderOpenIcon as FolderOpen } from "@phosphor-icons/react/dist/csr/FolderOpen";
import { GlobeIcon as Globe } from "@phosphor-icons/react/dist/csr/Globe";
import { MonitorIcon as Monitor } from "@phosphor-icons/react/dist/csr/Monitor";
import { ScanIcon as ScanSearch } from "@phosphor-icons/react/dist/csr/Scan";
import { MagnifyingGlassIcon as Search } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { ShieldIcon as Shield } from "@phosphor-icons/react/dist/csr/Shield";
import { Button, DialogNotice, Input, Select, Switch, Textarea, UiProvider } from "@modera/ui";
import { FieldRow, Form, FormItem, SettingsColumns, SettingsPage, SettingsPanel, SettingsSummary } from "@modera/ui/settings";
import { frontend, settingsAction, useSettings } from "@modera/plugin-sdk/react";
import { ChromeLogo, ChromiumLogo, EdgeLogo } from "./browser-logos";

export function SearchSettings() {
  const s = useSettings({ autoSave: true });
  const [logs, setLogs] = useState<{ path: string; text: string }>();
  const [browsers, setBrowsers] = useState<{ name: string; path: string }[]>([]);
  useEffect(() => { void frontend().ready().catch(() => {}); }, []);
  const t = (zh: string, en: string) => s.zh ? zh : en;
  const change = (key: string, value: string | number | boolean) => s.setValues((current) => ({ ...current, [key]: value }));
  const stats = [
    { icon: <Globe size={16} />, value: s.values.proxyEnabled ? t("自定义代理", "Custom proxy") : t("跟随系统", "System proxy"), label: t("代理", "Proxy") },
    { icon: <Search size={16} />, value: String(s.values.searchEngine ?? ""), label: t("搜索引擎", "Search engine") },
    { icon: <Monitor size={16} />, value: String(s.values.browserPath || t("自动检测", "Auto detect")), label: t("浏览器", "Browser"), title: String(s.values.browserPath ?? "") },
    { icon: <Shield size={16} />, value: String(String(s.values.blockedSites || "").split(/\s+/).filter(Boolean).length), label: t("屏蔽规则", "Blocked hosts") },
  ];
  return <UiProvider theme="system" locale={s.zh ? "zh-CN" : "en"} className="search-settings-ui">
    <SettingsPage title={t("代理和搜索引擎", "Proxy and search engines")} description={t("配置网络连接与网页搜索，应用于所有项目。", "Configure network access and web search for all projects.")}>
      {!s.config ? <DialogNotice tone={s.error ? "error" : "default"}>{s.error || t("正在加载…", "Loading…")}</DialogNotice> : <>
        <SettingsSummary items={stats} />
        <SettingsColumns columns={2}>
          <SettingsPanel title={t("连接与搜索", "Connection and search")} description={t("控制网络出口、默认搜索来源和等待时间。", "Control network routing, the default search source and wait time.")}>
            <Form columns={2}>
              <FormItem variant="inline" span="full" label={t("自定义 HTTP 代理", "Custom HTTP proxy")} description={t("关闭时自动继承系统代理", "Uses the system proxy when disabled")}><Switch label={t("自定义 HTTP 代理", "Custom HTTP proxy")} checked={!!s.values.proxyEnabled} onCheckedChange={(value) => change("proxyEnabled", value)} /></FormItem>
              <FormItem span="full" label={t("代理地址", "Proxy URL")}><Input label={t("代理地址", "Proxy URL")} hideLabel disabled={!s.values.proxyEnabled || s.busy} placeholder="http://127.0.0.1:7890" value={String(s.values.proxyUrl ?? "")} onChange={(value) => change("proxyUrl", value)} /></FormItem>
              <FormItem label={t("搜索引擎", "Search engine")}><Select label={t("搜索引擎", "Search engine")} value={String(s.values.searchEngine ?? "bing")} onValueChange={(value) => change("searchEngine", value)} options={[{ value: "bing", label: "Bing" }, { value: "duckduckgo", label: "DuckDuckGo" }]} /></FormItem>
              <FormItem label={t("搜索超时（秒）", "Search timeout (seconds)")}><Input label={t("搜索超时（秒）", "Search timeout (seconds)")} hideLabel type="number" min={5} max={60} value={Number(s.values.timeoutSeconds ?? 30)} onChange={(value) => { if (value !== "" && Number.isFinite(Number(value))) change("timeoutSeconds", Number(value)); }} /></FormItem>
            </Form>
          </SettingsPanel>
          <SettingsPanel title={t("浏览器执行环境", "Browser runtime")} description={t("选择网页检索使用的浏览器，留空时自动寻找可用版本。", "Choose the browser used for web retrieval, or leave it empty for automatic detection.")}>
            <Form><FormItem label={t("浏览器可执行文件路径", "Browser executable path")}><FieldRow><Input label={t("浏览器可执行文件路径", "Browser executable path")} hideLabel placeholder={t("留空自动检测 Chrome / Edge / Chromium", "Leave empty to detect Chrome / Edge / Chromium")} value={String(s.values.browserPath ?? "")} onChange={(value) => change("browserPath", value)} /><Button variant="outline" disabled={s.busy} onClick={() => void s.run(async () => { const path = await frontend().settings.pickFile(); if (path) change("browserPath", path); })}><FolderOpen size={14} />{t("浏览", "Browse")}</Button></FieldRow></FormItem></Form>
            <Button variant="outline" disabled={s.busy} onClick={() => void s.run(async () => setBrowsers(await settingsAction("scanBrowsers")))}><ScanSearch size={14} />{t("检测可用浏览器", "Detect browsers")}</Button>
            {browsers.length > 0 && <div className="search-browser-list">{browsers.map((browser) => <div className="search-browser" key={browser.path}>
              {browser.name === "Microsoft Edge" ? <EdgeLogo size={24} /> : browser.name === "Google Chrome" ? <ChromeLogo size={24} /> : browser.name === "Chromium" ? <ChromiumLogo size={24} /> : <Globe size={24} />}
              <span><strong>{browser.name}</strong><small>{browser.path}</small></span>
              <Button variant="outline" size="small" disabled={s.busy || s.values.browserPath === browser.path} onClick={() => change("browserPath", browser.path)}>{s.values.browserPath === browser.path ? t("已选择", "Selected") : t("使用", "Use")}</Button>
            </div>)}</div>}
          </SettingsPanel>
        </SettingsColumns>
        <SettingsColumns columns={2} className="search-secondary-grid">
          <SettingsPanel title={t("搜索边界", "Search boundaries")} description={t("为所有项目设置不可访问和不可出现在结果中的站点。", "Define sites that cannot be accessed or appear in results across projects.")}>
            <Form><FormItem label={t("屏蔽域名", "Blocked hosts")}><Textarea label={t("屏蔽域名", "Blocked hosts")} hideLabel rows={4} placeholder={t("每行一个域名，例如 example.com（包含子域名）", "One host per line, e.g. example.com (including subdomains)")} value={String(s.values.blockedSites ?? "")} onChange={(event) => change("blockedSites", event.target.value)} hint={t("匹配的站点将从搜索结果中过滤，且无法被抓取。", "Matching sites are filtered from results and cannot be fetched.")} /></FormItem></Form>
          </SettingsPanel>
          <SettingsPanel title={t("搜索诊断", "Search diagnostics")} description={t("查看连接、导航与内容提取的执行记录。", "Inspect connection, navigation and extraction events.")}>
            <Button variant="outline" disabled={s.busy} onClick={() => void s.run(async () => setLogs(await settingsAction("readDiagnostics")))}><FileText size={14} />{t("读取最近日志", "Read recent logs")}</Button>
            {logs && <div className="search-log"><small>{logs.path}</small><pre>{logs.text || t("暂无日志", "No logs yet")}</pre></div>}
          </SettingsPanel>
        </SettingsColumns>
      </>}
      {(s.error || s.message) && s.config && <DialogNotice tone={s.failed || s.error ? "error" : "default"}>{s.error || s.message}</DialogNotice>}
    </SettingsPage>
  </UiProvider>;
}
