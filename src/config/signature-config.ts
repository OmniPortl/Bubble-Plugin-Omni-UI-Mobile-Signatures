import type { BubbleProperties } from "../bubble/types";

export interface SignatureConfig {
  initialSignature: string;
  enabled: boolean;
  commitBehavior: "on_stroke_end" | "manual";
  commitDelayMs: number;
  fileNamePrefix: string;
  outputFormat: "png" | "jpeg";
  jpegQuality: number;
  penColor: string;
  minWidth: number;
  maxWidth: number;
  backgroundColor: string;
  minDistance: number;
  throttleMs: number;
  placeholderText: string;
  showToolbar: boolean;
  showClearButton: boolean;
  showUndoButton: boolean;
  showSaveButton: boolean;
  clearButtonLabel: string;
  undoButtonLabel: string;
  saveButtonLabel: string;
  toolbarBackgroundColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  buttonBorderColor: string;
}

function readProperty(properties: BubbleProperties, name: string, fallback: unknown): unknown {
  let value = properties[name];
  if (typeof value === "function") {
    try {
      value = (value as () => unknown)();
    } catch {
      value = fallback;
    }
  }
  return value === undefined || value === null ? fallback : value;
}

export function readText(properties: BubbleProperties, name: string, fallback = ""): string {
  let value = readProperty(properties, name, fallback);
  if (typeof value === "object" && value !== null) {
    const candidate = value as { url?: string | (() => string); value?: string };
    if (typeof candidate.url === "function") {
      try {
        value = candidate.url();
      } catch {
        value = fallback;
      }
    } else if (typeof candidate.url === "string") {
      value = candidate.url;
    } else if (typeof candidate.value === "string") {
      value = candidate.value;
    } else {
      value = fallback;
    }
  }
  return String(value ?? fallback);
}

export function readBoolean(properties: BubbleProperties, name: string, fallback: boolean): boolean {
  const value = readProperty(properties, name, fallback);
  if (value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (["false", "no", "0", "off"].includes(normalized)) return false;
  if (["true", "yes", "1", "on"].includes(normalized)) return true;
  return fallback;
}

function readNumber(
  properties: BubbleProperties,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  let value = Number(readProperty(properties, name, fallback));
  if (!Number.isFinite(value)) value = fallback;
  return Math.min(max, Math.max(min, value));
}

function readColor(properties: BubbleProperties, name: string, fallback: string): string {
  const value = readProperty(properties, name, fallback);
  if (!value) return fallback;
  if (typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    for (const key of ["css", "value", "color", "hex", "rgba", "rgb"]) {
      if (typeof candidate[key] === "string" && candidate[key]) return candidate[key];
    }
  }
  const text = String(value);
  return text === "[object Object]" ? fallback : text;
}

export function normalizeConfig(properties: BubbleProperties = {}): SignatureConfig {
  const minWidth = readNumber(properties, "min_width", 0.5, 0.1, 50);
  const outputFormat = readText(properties, "output_format", "png").toLowerCase() === "jpeg"
    ? "jpeg"
    : "png";
  const commitBehavior = readText(properties, "commit_behavior", "on_stroke_end").toLowerCase() === "manual"
    ? "manual"
    : "on_stroke_end";

  return {
    initialSignature: readText(properties, "initial_signature", ""),
    enabled: readBoolean(properties, "enabled", true),
    commitBehavior,
    commitDelayMs: Math.round(readNumber(properties, "commit_delay_ms", 500, 0, 10_000)),
    fileNamePrefix: readText(properties, "file_name_prefix", "signature") || "signature",
    outputFormat,
    jpegQuality: readNumber(properties, "jpeg_quality", 0.92, 0, 1),
    penColor: readColor(properties, "pen_color", "#111827"),
    minWidth,
    maxWidth: readNumber(properties, "max_width", 2.5, minWidth, 50),
    backgroundColor: readColor(properties, "background_color", "#ffffff"),
    minDistance: readNumber(properties, "min_distance", 5, 0, 50),
    throttleMs: Math.round(readNumber(properties, "throttle_ms", 16, 0, 1000)),
    placeholderText: readText(properties, "placeholder_text", "Sign here"),
    showToolbar: readBoolean(properties, "show_toolbar", true),
    showClearButton: readBoolean(properties, "show_clear_button", true),
    showUndoButton: readBoolean(properties, "show_undo_button", true),
    showSaveButton: readBoolean(properties, "show_save_button", true),
    clearButtonLabel: readText(properties, "clear_button_label", "Clear"),
    undoButtonLabel: readText(properties, "undo_button_label", "Undo"),
    saveButtonLabel: readText(properties, "save_button_label", "Save"),
    toolbarBackgroundColor: readColor(properties, "toolbar_background_color", "#f8fafc"),
    buttonBackgroundColor: readColor(properties, "button_background_color", "#ffffff"),
    buttonTextColor: readColor(properties, "button_text_color", "#111827"),
    buttonBorderColor: readColor(properties, "button_border_color", "#cbd5e1"),
  };
}

export function sanitizeFilePrefix(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "signature";
}
