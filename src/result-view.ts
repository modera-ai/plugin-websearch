import type { PluginUiView } from "@modera/plugin-sdk";

/** Stored results can also be kernel error/truncation envelopes, not just plugin success data. */
export function readResult(
  raw: string | undefined,
  title: string,
  zh: boolean,
  pending?: { label: string; description?: string },
): { value?: unknown; partial?: boolean; view?: PluginUiView } {
  if (raw === undefined)
    return {
      view: {
        title,
        live: true,
        children: [
          {
            type: "progress",
            label: pending?.label ?? (zh ? "正在处理…" : "Working…"),
            ...(pending?.description
              ? { description: pending.description }
              : {}),
          },
        ],
      },
    };
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object" && "error" in value)
      return {
        view: {
          title,
          children: [
            { type: "text", text: String(value.error).slice(0, 4000) },
          ],
        },
      };
    if (
      value &&
      typeof value === "object" &&
      "preview" in value &&
      "truncated" in value
    ) {
      if (value.preview && typeof value.preview === "object")
        return { value: value.preview, partial: true };
      return {
        view: {
          title,
          children: [
            {
              type: "text",
              text: zh
                ? "结果已生成，但当前预览空间不足。完整结果可通过工具结果引用继续读取。"
                : "Result generated; preview space is limited. Use the retained result reference to continue reading.",
            },
          ],
        },
      };
    }
    return { value };
  } catch {
    return { view: invalidResult(title, zh) };
  }
}
export function invalidResult(title: string, zh: boolean): PluginUiView {
  return {
    title,
    children: [
      {
        type: "text",
        text: zh
          ? "结果格式无法识别，请查看工具原始结果或重试。"
          : "Unrecognized result format. Inspect the raw result or retry.",
      },
    ],
  };
}

export function partialResult(
  title: string,
  value: unknown,
  zh: boolean,
): PluginUiView {
  return {
    title,
    children: [
      {
        type: "text",
        text: zh
          ? "当前为部分结果预览，完整内容可通过结果引用继续读取。"
          : "Partial result preview; use the result reference to read more.",
      },
      { type: "code", text: JSON.stringify(value, null, 2).slice(0, 12000) },
    ],
  };
}
