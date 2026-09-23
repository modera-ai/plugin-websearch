import manifest from "../plugin.json";
import type { Page } from "puppeteer-core";
import type { ToolDefinition } from "@modera/plugin-sdk";
import { declaredTool, webUrl } from "@modera/plugin-sdk";
import { readPageIcon } from "./page-icon";
export const fetchDefinition = declaredTool(manifest, "web_fetch");
export async function fetchPage(
  page: Page,
  input: { url: string; offset?: number; maxChars?: number },
  signal: AbortSignal,
) {
  const response = await page.goto(webUrl(input.url).href, {
    waitUntil: "domcontentloaded",
    timeout: 0,
  });
  if (response && response.status() >= 400)
    throw new Error(`HTTP_${response.status()}`);
  await page
    .waitForNetworkIdle({ idleTime: 300, timeout: 3000 })
    .catch(() => {});
  const data = await page.evaluate(
    ({ offset, maxChars }) => {
      const title = document.title.slice(0, 500);
      if (
        document.querySelector(
          "#challenge-form,.anomaly-modal,#b_captcha,#captcha,#challenge-running",
        ) ||
        /^(just a moment|verify.*human|security check)/i.test(title)
      )
        throw new Error("PAGE_CHALLENGE: verification required");
      document
        .querySelectorAll(
          "script,style,noscript,template,nav,footer,header,svg",
        )
        .forEach((node) => node.remove());
      const root = document.querySelector("main,article") ?? document.body;
      // Cap iteration/output inside the browser as well as the wire result.
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let text = "",
        nodes = 0;
      while (walker.nextNode() && text.length <= 220000 && nodes++ < 50000) {
        const chunk = walker.currentNode.textContent
          ?.replace(/\s+/g, " ")
          .trim();
        if (chunk) text += chunk.slice(0, 220001 - text.length) + "\n";
      }
      const truncated = text.length > offset + maxChars || nodes >= 50000;
      const iconUrl =
        document.querySelector<HTMLLinkElement>(
          'link[rel~="icon"],link[rel="shortcut icon"]',
        )?.href || new URL("/favicon.ico", location.href).href;
      return {
        title,
        iconUrl,
        text: text.slice(offset, offset + maxChars),
        truncated,
        nextOffset:
          truncated && offset + maxChars < 200000 ? offset + maxChars : null,
      };
    },
    { offset: input.offset ?? 0, maxChars: input.maxChars ?? 12000 },
  );
  signal.throwIfAborted();
  const icon = await readPageIcon(page, data.iconUrl);
  return {
    url: page.url(),
    title: data.title,
    text: data.text,
    truncated: data.truncated,
    nextOffset: data.nextOffset,
    ...(icon && icon.length <= 2000 ? { icon } : {}),
    contentTrust: "untrusted",
    mode: "browser",
    bytes: Buffer.byteLength(data.text),
  };
}
