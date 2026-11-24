import type { BubbleElementInstance } from "../bubble/types";
import type { SignatureConfig } from "../config/signature-config";

type ButtonKey = "undo" | "clear" | "save";

export interface ViewActions {
  undo(): void;
  clear(): void;
  save(): void;
}

export class SignatureView {
  readonly root: HTMLDivElement;
  readonly toolbar: HTMLDivElement;
  readonly stage: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  readonly placeholder: HTMLDivElement;
  readonly buttons: Record<ButtonKey, HTMLButtonElement>;

  constructor(instance: BubbleElementInstance, actions: ViewActions) {
    const host = instance.canvas?.[0] ?? instance.canvas?.get?.(0);
    if (!host) throw new Error("Signature pad host is not ready.");

    instance.canvas.empty?.();
    host.innerHTML = "";

    this.root = document.createElement("div");
    this.toolbar = document.createElement("div");
    this.stage = document.createElement("div");
    this.canvas = document.createElement("canvas");
    this.placeholder = document.createElement("div");
    this.buttons = {
      undo: this.button("Undo", actions.undo),
      clear: this.button("Clear", actions.clear),
      save: this.button("Save", actions.save),
    };

    this.root.className = "omni-signature-root";
    this.toolbar.className = "omni-signature-toolbar";
    this.stage.className = "omni-signature-stage";
    this.canvas.className = "omni-signature-canvas";
    this.placeholder.className = "omni-signature-placeholder";

    this.toolbar.append(this.buttons.undo, this.buttons.clear, this.buttons.save);
    this.stage.append(this.canvas, this.placeholder);
    this.root.append(this.stage, this.toolbar);
    host.append(this.root);

    this.root.style.cssText = "box-sizing:border-box;display:flex;flex-direction:column;width:100%;height:100%;min-height:120px;overflow:hidden";
    this.stage.style.cssText = "position:relative;flex:1 1 auto;min-height:80px;overflow:hidden";
    this.canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;cursor:crosshair";
    this.placeholder.style.cssText = "position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;pointer-events:none;font-size:14px;opacity:.55";
    this.toolbar.style.cssText = "flex:0 0 auto;display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:8px;box-sizing:border-box";
    Object.values(this.buttons).forEach((item) => {
      item.style.cssText = "box-sizing:border-box;min-height:32px;padding:6px 12px;border-radius:6px;border-style:solid;border-width:1px;font:inherit;cursor:pointer";
    });
  }

  apply(config: SignatureConfig, isUploading: boolean): void {
    this.root.style.backgroundColor = config.backgroundColor;
    this.stage.style.backgroundColor = config.backgroundColor;
    this.toolbar.style.backgroundColor = config.toolbarBackgroundColor;
    this.toolbar.style.display = config.showToolbar ? "flex" : "none";
    this.placeholder.textContent = config.placeholderText;

    this.buttons.undo.textContent = config.undoButtonLabel;
    this.buttons.clear.textContent = config.clearButtonLabel;
    this.buttons.save.textContent = config.saveButtonLabel;
    this.buttons.undo.style.display = config.showUndoButton ? "" : "none";
    this.buttons.clear.style.display = config.showClearButton ? "" : "none";
    this.buttons.save.style.display = config.showSaveButton ? "" : "none";

    Object.values(this.buttons).forEach((item) => {
      item.style.backgroundColor = config.buttonBackgroundColor;
      item.style.borderColor = config.buttonBorderColor;
      item.style.color = config.buttonTextColor;
      item.disabled = !config.enabled || isUploading;
      item.style.opacity = item.disabled ? "0.55" : "1";
      item.style.cursor = item.disabled ? "not-allowed" : "pointer";
    });

    this.canvas.style.pointerEvents = config.enabled ? "auto" : "none";
    this.canvas.style.cursor = config.enabled ? "crosshair" : "not-allowed";
    this.root.style.opacity = config.enabled ? "1" : "0.72";
  }

  showPlaceholder(show: boolean): void {
    this.placeholder.style.display = show ? "block" : "none";
  }

  destroy(): void {
    this.root.remove();
  }

  private button(label: string, action: () => void): HTMLButtonElement {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.addEventListener("click", (event) => {
      event.preventDefault();
      action();
    });
    return element;
  }
}
