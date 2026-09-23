import type { Page } from "puppeteer-core";

/** Fetch a bounded icon inside the plugin's isolated browser session. */
export async function readPageIcon(
  page: Page,
  url: string | undefined,
): Promise<string | undefined> {
  if (!url) return undefined;
  return page.evaluate(async (source) => {
    if (/^data:image\/(?:png|jpeg|webp|x-icon);base64,/.test(source))
      return source.length <= 20_000 ? source : undefined;
    try {
      const response = await fetch(source, { credentials: "omit" });
      const rawMime = response.headers.get("content-type")?.split(";")[0];
      const mime =
        rawMime === "image/vnd.microsoft.icon" ? "image/x-icon" : rawMime;
      if (
        !response.ok ||
        !mime ||
        !["image/png", "image/jpeg", "image/webp", "image/x-icon"].includes(
          mime,
        )
      )
        return undefined;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 12_000) return undefined;
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return `data:${mime};base64,${btoa(binary)}`;
    } catch {
      return undefined;
    }
  }, url);
}

/** Try the conventional target-site favicon through the already policy-bound page. */
export async function readSiteFavicon(
  page: Page,
  pageUrl: string,
): Promise<string | undefined> {
  try {
    const faviconUrl = new URL("/favicon.ico", pageUrl).href;
    const response = await page.goto(faviconUrl, {
      waitUntil: "domcontentloaded",
      timeout: 1200,
    });
    if (!response?.ok()) return undefined;
    const rawType = response.headers()["content-type"]?.split(";")[0];
    const type =
      rawType === "image/vnd.microsoft.icon" ? "image/x-icon" : rawType;
    const declared = Number(response.headers()["content-length"] ?? 0);
    if (
      !type ||
      !["image/png", "image/jpeg", "image/webp", "image/x-icon"].includes(
        type,
      ) ||
      declared > 12_000
    )
      return undefined;
    const bytes = await response.buffer();
    if (bytes.length > 12_000) return undefined;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return undefined;
  }
}
