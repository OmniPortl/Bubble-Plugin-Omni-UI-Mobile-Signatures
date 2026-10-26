import type { BubbleElementInstance, BubbleProperties } from "./bubble/types";
import { normalizeConfig } from "./config/signature-config";

export function preview(instance: BubbleElementInstance, properties: BubbleProperties): void {
  const host = instance.canvas?.[0] ?? instance.canvas?.get?.(0);
  if (!host) return;
  const config = normalizeConfig(properties || {});
  instance.canvas.empty?.();
  host.innerHTML = "";

  const preview = document.createElement("div");
  preview.style.cssText = [
    "box-sizing:border-box",
    "width:100%",
    "height:100%",
    "min-height:120px",
    "display:flex",
    "flex-direction:column",
    `background:${config.backgroundColor}`,
    "border:1px dashed #cbd5e1",
    "overflow:hidden",
  ].join(";");
  const stage = document.createElement("div");
  stage.textContent = config.placeholderText;
  stage.style.cssText = "flex:1;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:14px";
  const toolbar = document.createElement("div");
  toolbar.textContent = [config.undoButtonLabel, config.clearButtonLabel, config.saveButtonLabel].join("   ");
  toolbar.style.cssText = `padding:8px;text-align:right;background:${config.toolbarBackgroundColor};color:${config.buttonTextColor};font-size:12px`;
  toolbar.style.display = config.showToolbar ? "block" : "none";
  preview.append(stage, toolbar);
  host.append(preview);
}
