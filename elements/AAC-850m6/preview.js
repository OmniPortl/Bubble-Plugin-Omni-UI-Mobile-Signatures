function(instance, properties) {
  "use strict";
  var OmniSignaturePreviewBundle = (() => {
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

    // src/preview.ts
    var preview_exports = {};
    __export(preview_exports, {
      preview: () => preview
    });

    // src/config/signature-config.ts
    function readProperty(properties, name, fallback) {
      let value = properties[name];
      if (typeof value === "function") {
        try {
          value = value();
        } catch {
          value = fallback;
        }
      }
      return value === void 0 || value === null ? fallback : value;
    }
    function readText(properties, name, fallback = "") {
      let value = readProperty(properties, name, fallback);
      if (typeof value === "object" && value !== null) {
        const candidate = value;
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
    function readBoolean(properties, name, fallback) {
      const value = readProperty(properties, name, fallback);
      if (value === "") return fallback;
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      const normalized = String(value).trim().toLowerCase();
      if (["false", "no", "0", "off"].includes(normalized)) return false;
      if (["true", "yes", "1", "on"].includes(normalized)) return true;
      return fallback;
    }
    function readNumber(properties, name, fallback, min, max) {
      let value = Number(readProperty(properties, name, fallback));
      if (!Number.isFinite(value)) value = fallback;
      return Math.min(max, Math.max(min, value));
    }
    function readColor(properties, name, fallback) {
      const value = readProperty(properties, name, fallback);
      if (!value) return fallback;
      if (typeof value === "object") {
        const candidate = value;
        for (const key of ["css", "value", "color", "hex", "rgba", "rgb"]) {
          if (typeof candidate[key] === "string" && candidate[key]) return candidate[key];
        }
      }
      const text = String(value);
      return text === "[object Object]" ? fallback : text;
    }
    function normalizeConfig(properties = {}) {
      const minWidth = readNumber(properties, "min_width", 0.5, 0.1, 50);
      const outputFormat = readText(properties, "output_format", "png").toLowerCase() === "jpeg" ? "jpeg" : "png";
      const commitBehavior = readText(properties, "commit_behavior", "on_stroke_end").toLowerCase() === "manual" ? "manual" : "on_stroke_end";
      return {
        initialSignature: readText(properties, "initial_signature", ""),
        enabled: readBoolean(properties, "enabled", true),
        commitBehavior,
        commitDelayMs: Math.round(readNumber(properties, "commit_delay_ms", 500, 0, 1e4)),
        fileNamePrefix: readText(properties, "file_name_prefix", "signature") || "signature",
        outputFormat,
        jpegQuality: readNumber(properties, "jpeg_quality", 0.92, 0, 1),
        penColor: readColor(properties, "pen_color", "#111827"),
        minWidth,
        maxWidth: readNumber(properties, "max_width", 2.5, minWidth, 50),
        backgroundColor: readColor(properties, "background_color", "#ffffff"),
        minDistance: readNumber(properties, "min_distance", 5, 0, 50),
        throttleMs: Math.round(readNumber(properties, "throttle_ms", 16, 0, 1e3)),
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
        buttonBorderColor: readColor(properties, "button_border_color", "#cbd5e1")
      };
    }

    // src/preview.ts
    function preview(instance, properties) {
      const host = instance.canvas?.[0] ?? instance.canvas?.get?.(0);
      if (!host) return;
      const config = normalizeConfig(properties || {});
      instance.canvas.empty?.();
      host.innerHTML = "";
      const preview2 = document.createElement("div");
      preview2.style.cssText = [
        "box-sizing:border-box",
        "width:100%",
        "height:100%",
        "min-height:120px",
        "display:flex",
        "flex-direction:column",
        `background:${config.backgroundColor}`,
        "border:1px dashed #cbd5e1",
        "overflow:hidden"
      ].join(";");
      const stage = document.createElement("div");
      stage.textContent = config.placeholderText;
      stage.style.cssText = "flex:1;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:14px";
      const toolbar = document.createElement("div");
      toolbar.textContent = [config.undoButtonLabel, config.clearButtonLabel, config.saveButtonLabel].join("   ");
      toolbar.style.cssText = `padding:8px;text-align:right;background:${config.toolbarBackgroundColor};color:${config.buttonTextColor};font-size:12px`;
      toolbar.style.display = config.showToolbar ? "block" : "none";
      preview2.append(stage, toolbar);
      host.append(preview2);
    }
    return __toCommonJS(preview_exports);
  })();
  OmniSignaturePreviewBundle.preview(instance, properties || {});
}
