import type { Page } from "puppeteer-core";
import { webUrl } from "@modera/plugin-sdk";
import { readSiteFavicon } from "./page-icon";
export type EngineId = "duckduckgo" | "bing";
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  icon?: string;
}
export interface SearchResponse {
  query: string;
  engine: EngineId;
  status: "ok" | "no_results" | "challenge" | "layout_changed";
  results: SearchResult[];
  contentTrust: "untrusted";
}

export function resultUrl(raw: string, engine: EngineId): string | undefined {
  if (!raw.trim() || raw.startsWith("#")) return undefined;
  try {
    let url = new URL(
      raw,
      engine === "bing"
        ? "https://www.bing.com"
        : "https://lite.duckduckgo.com",
    );
    if (
      (url.hostname === "duckduckgo.com" ||
        url.hostname.endsWith(".duckduckgo.com")) &&
      url.searchParams.has("uddg")
    )
      url = new URL(url.searchParams.get("uddg")!);
    if (
      (url.hostname === "bing.com" || url.hostname.endsWith(".bing.com")) &&
      url.pathname === "/ck/a"
    ) {
      const wrapped = url.searchParams.get("u");
      if (!wrapped?.startsWith("a1")) return undefined;
      url = new URL(
        Buffer.from(wrapped.slice(2), "base64url").toString("utf8"),
      );
    }
    return webUrl(url.href).href;
  } catch {
    return undefined;
  }
}

/** DOM selectors are engine-specific; execution, lifecycle and URL policy stay shared. */
export async function extractSearch(
  page: Page,
  engine: EngineId,
  query: string,
  limit: number,
): Promise<SearchResponse> {
  const extracted = await page.evaluate(
    ({ engine, limit }) => {
      const text = document.body?.innerText?.slice(0, 100000) ?? "";
      const challenge =
        !!document.querySelector(
          "#challenge-form,.anomaly-modal,#b_captcha,#captcha,#challenge-running,iframe[src*='captcha']",
        ) ||
        /^(just a moment|verify (that )?you are (a )?human|security check|请完成验证)/i.test(
          document.title.trim(),
        );
      const empty =
        !!document.querySelector(".b_no,.no-results,.no-results__message") ||
        /no results (found|for)|没有找到|未找到.*结果/i.test(text);
      const candidates: {
        title: string;
        url: string;
        snippet: string;
        iconUrl?: string;
      }[] = [];
      const clean = (value: string | null | undefined, max: number) =>
        (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
      if (engine === "bing") {
        for (const item of Array.from(
          document.querySelectorAll("#b_results li.b_algo"),
        ).slice(0, 100)) {
          if (candidates.length >= limit * 3) break;
          if (
            item.classList.contains("b_ad") ||
            item.querySelector(".b_adlabel,.b_ad_text")
          )
            continue;
          const heading = item.querySelector("h2 a");
          const link = item.querySelector(".b_tpcn a.tilk") ?? heading;
          if (link) {
            const icon = item.querySelector<HTMLImageElement>("img[src]");
            const iconUrl = icon?.currentSrc || icon?.src;
            candidates.push({
              title: clean(
                heading?.textContent ||
                  link.getAttribute("aria-label") ||
                  link.textContent,
                300,
              ),
              url: link.getAttribute("href")?.slice(0, 4000) ?? "",
              snippet: clean(
                item.querySelector(
                  ".b_caption p,.b_snippet,.b_caption,.b_paractl",
                )?.textContent,
                1200,
              ),
              ...(iconUrl ? { iconUrl } : {}),
            });
          }
        }
      } else {
        let current:
          { title: string; url: string; snippet: string } | undefined;
        for (const row of Array.from(
          document.querySelectorAll("table tr"),
        ).slice(0, 500)) {
          const link = row.querySelector("a.result-link");
          if (link) {
            if (current) candidates.push(current);
            if (candidates.length >= limit * 3) {
              current = undefined;
              break;
            }
            current = {
              title: clean(link.textContent, 300),
              url: link.getAttribute("href")?.slice(0, 4000) ?? "",
              snippet: "",
            };
          } else if (current && row.querySelector(".result-snippet"))
            current.snippet = clean(
              row.querySelector(".result-snippet")?.textContent,
              1200,
            );
        }
        if (current) candidates.push(current);
      }
      return { candidates, challenge, empty };
    },
    { engine, limit },
  );
  const seen = new Set<string>();
  const icons = await page.evaluate(
    async (urls) => {
      const read = async (url: string | undefined) => {
        if (!url) return undefined;
        if (/^data:image\/(?:png|jpeg|webp|x-icon);base64,/.test(url))
          return url.length <= 20_000 ? url : undefined;
        try {
          const response = await fetch(url, { credentials: "omit" });
          const mime = response.headers.get("content-type")?.split(";")[0];
          if (
            !response.ok ||
            !mime ||
            !["image/png", "image/jpeg", "image/webp", "image/x-icon"].includes(
              mime,
            )
          )
            return undefined;
          const reader = response.body?.getReader();
          if (!reader) return undefined;
          const chunks: Uint8Array[] = [];
          let size = 0;
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.length;
            if (size > 12_000) {
              await reader.cancel();
              return undefined;
            }
            chunks.push(part.value);
          }
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
          }
          let binary = "";
          for (const byte of bytes) binary += String.fromCharCode(byte);
          return `data:${mime};base64,${btoa(binary)}`;
        } catch {
          return undefined;
        }
      };
      return Promise.all(urls.map(read));
    },
    extracted.candidates.map((item) => item.iconUrl),
  );
  const results: SearchResult[] = [];
  if (!extracted.challenge)
    for (const [index, item] of extracted.candidates.entries()) {
      const url = resultUrl(item.url, engine);
      if (!url || !item.title || seen.has(url)) continue;
      seen.add(url);
      const { iconUrl: _iconUrl, ...value } = item;
      results.push({
        ...value,
        url,
        source: new URL(url).hostname,
        ...(icons[index] ? { icon: icons[index] } : {}),
      });
      if (results.length >= limit) break;
    }
  // Search pages often expose a generic engine icon. Prefer the destination's
  // conventional favicon for the first visible results, using the same egress-bound page.
  for (const result of results.slice(0, 5)) {
    const icon = await readSiteFavicon(page, result.url);
    if (icon) result.icon = icon;
  }
  // Decoration must not crowd out textual search evidence.
  let iconBudget = 2000;
  for (const result of results) {
    if ((result.icon?.length ?? 0) > iconBudget) delete result.icon;
    else iconBudget -= result.icon?.length ?? 0;
  }
  return {
    query,
    engine,
    status: extracted.challenge
      ? "challenge"
      : results.length
        ? "ok"
        : extracted.empty
          ? "no_results"
          : "layout_changed",
    results,
    contentTrust: "untrusted",
  };
}
export async function searchWeb(
  page: Page,
  engine: EngineId,
  query: string,
  limit: number,
  signal: AbortSignal,
  trace?: (phase: string, details?: Record<string, unknown>) => void,
) {
  const url =
    engine === "bing"
      ? `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${limit}`
      : `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  trace?.("navigation.start", { engine, host: new URL(url).hostname });
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 0,
  });
  trace?.("navigation.loaded", {
    status: response?.status(),
    host: new URL(page.url()).hostname,
  });
  await page
    .waitForNetworkIdle({ idleTime: 500, concurrency: 2, timeout: 5000 })
    .catch(() => trace?.("navigation.idle-timeout"));
  if (response && response.status() >= 400)
    throw new Error(`HTTP_${response.status()}`);
  const result = await extractSearch(page, engine, query, limit);
  trace?.("extraction.completed", {
    status: result.status,
    results: result.results.length,
  });
  signal.throwIfAborted();
  return result;
}
