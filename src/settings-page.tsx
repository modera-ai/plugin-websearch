import { useState } from "react";
import {
  SettingsPage,
  SettingsCard,
  Button,
  Field,
  frontend,
} from "@modera/plugin-sdk/react";
import { ChromeLogo, ChromiumLogo, EdgeLogo } from "./browser-logos";
import {
  Globe,
  Search,
  Monitor,
  Shield,
  FolderOpen,
  FileText,
  ScanSearch,
} from "lucide-react";
import { useSettings, settingsAction } from "@modera/plugin-sdk/react";
export function SearchSettings() {
  const s = useSettings({ autoSave: true }),
    t = (a: string, b: string) => (s.zh ? a : b);
  const [logs, setLogs] = useState<{ path: string; text: string }>();
  const [browsers, setBrowsers] = useState<{ name: string; path: string }[]>(
    [],
  );
  if (!s.config)
    return s.error ? (
      <SettingsPage title={t("设置", "Settings")}>
        <p role="alert">{s.error}</p>
      </SettingsPage>
    ) : null;
  const change = (key: string, value: string | number | boolean) =>
    s.setValues((v) => ({ ...v, [key]: value }));
  const stats = [
    {
      Icon: Globe,
      value: s.values.proxyEnabled
        ? t("自定义代理", "Custom proxy")
        : t("跟随系统", "System proxy"),
      label: t("代理", "Proxy"),
    },
    {
      Icon: Search,
      value: s.values.searchEngine,
      label: t("搜索引擎", "Search engine"),
    },
    {
      Icon: Monitor,
      value: s.values.browserPath || t("自动检测", "Auto detect"),
      label: t("浏览器", "Browser"),
    },
    {
      Icon: Shield,
      value: String(s.values.blockedSites || "")
        .split(/\s+/)
        .filter(Boolean).length,
      label: t("屏蔽规则", "Blocked hosts"),
    },
  ];
  return (
    <SettingsPage title={t("代理和搜索引擎", "Proxy and search engines")}>
      <p className="df-description">
        {t(
          "配置网络连接与网页搜索，应用于所有项目。",
          "Configure network access and web search for all projects.",
        )}
      </p>
      <div className="search-summary">
        {stats.map(({ Icon, value, label }) => (
          <div className="search-metric" key={label}>
            <Icon size={16} />
            <span>
              <strong title={String(value)}>{String(value)}</strong>
              <small>{label}</small>
            </span>
          </div>
        ))}
      </div>
      <div className="search-settings-grid">
        <SettingsCard title={t("连接与搜索", "Connection and search")}>
          <p>
            {t(
              "控制网络出口、默认搜索来源和等待时间。",
              "Control network routing, the default search source and wait time.",
            )}
          </p>
          <label className="search-toggle-row">
            <span>
              <strong>{t("自定义 HTTP 代理", "Custom HTTP proxy")}</strong>
              <small>
                {t(
                  "关闭时自动继承系统代理",
                  "Uses the system proxy when disabled",
                )}
              </small>
            </span>
            <input
              className="df-switch"
              type="checkbox"
              aria-label={t("自定义代理", "Custom proxy")}
              checked={!!s.values.proxyEnabled}
              onChange={(e) => change("proxyEnabled", e.target.checked)}
            />
          </label>
          <Field label={t("代理地址", "Proxy URL")}>
            <input
              disabled={!s.values.proxyEnabled || s.busy}
              placeholder="http://127.0.0.1:7890"
              value={String(s.values.proxyUrl ?? "")}
              onChange={(e) => change("proxyUrl", e.target.value)}
            />
          </Field>
          <div className="df-grid search-compact-fields">
            <Field label={t("搜索引擎", "Search engine")}>
              <select
                value={String(s.values.searchEngine)}
                onChange={(e) => change("searchEngine", e.target.value)}
              >
                <option value="duckduckgo">DuckDuckGo</option>
                <option value="bing">Bing</option>
              </select>
            </Field>
            <Field label={t("搜索超时（秒）", "Search timeout (seconds)")}>
              <input
                type="number"
                min={5}
                max={60}
                value={Number(s.values.timeoutSeconds)}
                onChange={(e) =>
                  change("timeoutSeconds", Number(e.target.value))
                }
              />
            </Field>
          </div>
        </SettingsCard>
        <SettingsCard title={t("浏览器执行环境", "Browser runtime")}>
          <p>
            {t(
              "选择网页检索使用的浏览器，留空时自动寻找可用版本。",
              "Choose the browser used for web retrieval, or leave it empty for automatic detection.",
            )}
          </p>
          <Field label={t("浏览器可执行文件路径", "Browser executable path")}>
            <div className="df-row">
              <input
                placeholder={t(
                  "留空自动检测 Chrome / Edge / Chromium",
                  "Leave empty to detect Chrome / Edge / Chromium",
                )}
                value={String(s.values.browserPath ?? "")}
                onChange={(e) => change("browserPath", e.target.value)}
              />
              <Button
                disabled={s.busy}
                onClick={() =>
                  void s.run(async () => {
                    const path = await frontend().settings.pickFile();
                    if (path) change("browserPath", path);
                  })
                }
              >
                <FolderOpen size={14} />
                {t("浏览", "Browse")}
              </Button>
            </div>
          </Field>
          <Button
            disabled={s.busy}
            onClick={() =>
              void s.run(async () =>
                setBrowsers(await settingsAction("scanBrowsers")),
              )
            }
          >
            <ScanSearch size={14} />
            {t("检测可用浏览器", "Detect browsers")}
          </Button>
          <div className="search-browser-results">
            {browsers.map((b) => (
              <div className="df-list-row" key={b.path}>
                {b.name === "Microsoft Edge" ? (
                  <EdgeLogo size={24} />
                ) : b.name === "Google Chrome" ? (
                  <ChromeLogo size={24} />
                ) : b.name === "Chromium" ? (
                  <ChromiumLogo size={24} />
                ) : (
                  <Globe size={24} />
                )}
                <span className="grow">
                  <strong>{b.name}</strong>
                  <small>{b.path}</small>
                </span>
                <Button
                  disabled={s.busy || s.values.browserPath === b.path}
                  onClick={() => change("browserPath", b.path)}
                >
                  {s.values.browserPath === b.path
                    ? t("已选择", "Selected")
                    : t("使用", "Use")}
                </Button>
              </div>
            ))}
          </div>
        </SettingsCard>
      </div>
      <div className="search-settings-grid search-secondary-grid">
        <SettingsCard title={t("搜索边界", "Search boundaries")}>
          <p>
            {t(
              "为所有项目设置不可访问和不可出现在结果中的站点。",
              "Define sites that cannot be accessed or appear in results across projects.",
            )}
          </p>
          <Field label={t("屏蔽域名", "Blocked hosts")}>
            <textarea
              rows={4}
              placeholder={t(
                "每行一个域名，例如 example.com（包含子域名）",
                "One host per line, e.g. example.com (includes subdomains)",
              )}
              value={String(s.values.blockedSites ?? "")}
              onChange={(e) => change("blockedSites", e.target.value)}
            />
            <small>
              {t(
                "匹配的站点将从搜索结果中过滤，且无法被抓取。",
                "Matching sites are filtered from search results and cannot be fetched.",
              )}
            </small>
          </Field>
        </SettingsCard>
        <SettingsCard title={t("搜索诊断", "Search diagnostics")}>
          <p>
            {t(
              "查看连接、导航与内容提取的执行记录。",
              "Inspect connection, navigation and extraction events.",
            )}
          </p>
          <Button
            disabled={s.busy}
            onClick={() =>
              void s.run(async () =>
                setLogs(await settingsAction("readDiagnostics")),
              )
            }
          >
            <FileText size={14} />
            {t("读取最近日志", "Read recent logs")}
          </Button>
          {logs && (
            <div className="search-log">
              <small>{logs.path}</small>
              <pre>{logs.text || t("暂无日志", "No logs yet")}</pre>
            </div>
          )}
        </SettingsCard>
      </div>
      {(s.error || s.message) && (
        <div
          role={s.failed ? "alert" : "status"}
          className={"df-notice" + (s.failed ? " warning" : "")}
        >
          {s.error || s.message}
        </div>
      )}
    </SettingsPage>
  );
}
