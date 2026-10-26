import SignaturePad from "signature_pad";
import type { PointGroup } from "signature_pad";
import type { BubbleContext, BubbleElementInstance, BubbleProperties, UploadCallback } from "../bubble/types";
import { BubbleBridge } from "../bridge/bubble-bridge";
import { normalizeConfig, readBoolean, sanitizeFilePrefix, type SignatureConfig } from "../config/signature-config";
import { SignatureView } from "../view/signature-view";

export const RUNTIME_KEY = "omniSignatureRuntime";

export interface SignatureRuntimeApi {
  update(properties: BubbleProperties, context: BubbleContext): void;
  saveSignature(context?: BubbleContext): Promise<void>;
  clearSignature(): void;
  undoLastStroke(): void;
  setEnabled(enabled: unknown): void;
  destroy(): void;
}

export class SignatureRuntime implements SignatureRuntimeApi {
  private readonly bridge: BubbleBridge;
  private config: SignatureConfig = normalizeConfig({});
  private latestContext: BubbleContext;
  private view: SignatureView | null = null;
  private pad: SignaturePad | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCommitTimer: ReturnType<typeof setTimeout> | null = null;
  private initialSignatureKey: string | null = null;
  private initialSignatureRevision = 0;
  private isDrawing = false;
  private isUploading = false;
  private destroyed = false;

  constructor(private readonly instance: BubbleElementInstance, context: BubbleContext) {
    this.latestContext = context;
    this.bridge = new BubbleBridge(instance);
    this.bridge.publishInitialState();
  }

  update(properties: BubbleProperties, context: BubbleContext): void {
    if (this.destroyed) return;
    this.latestContext = context || this.latestContext;
    this.config = normalizeConfig(properties || {});

    try {
      this.ensureView();
      this.ensurePad();
      this.applyPadConfig();
      this.view?.apply(this.config, this.isUploading);
      this.resizeCanvas(true);
      this.applyInitialSignature();
      this.bridge.publishState("is_uploading", this.isUploading);
      this.bridge.publishState("is_drawing", this.isDrawing);
      this.publishDrawingState(false);
    } catch (error) {
      this.bridge.error(messageOf(error, "Unable to initialize signature pad."));
    }
  }

  async saveSignature(context?: BubbleContext): Promise<void> {
    this.latestContext = context || this.latestContext;
    if (!this.pad) {
      this.bridge.error("Signature pad is not ready.");
      return;
    }
    if (this.pad.isEmpty()) {
      this.bridge.error("Signature is empty.");
      return;
    }
    if (this.isUploading) return;

    let dataUrl: string;
    try {
      dataUrl = this.exportDataUrl();
    } catch (error) {
      this.bridge.error(messageOf(error, "Unable to render signature image."));
      return;
    }

    this.bridge.publishState("signature_data_url", dataUrl);
    this.isUploading = true;
    this.bridge.publishState("is_uploading", true);
    this.view?.apply(this.config, true);

    try {
      const url = await this.uploadDataUrl(dataUrl, this.latestContext);
      if (!url) throw new Error("Bubble returned an empty upload URL.");
      this.bridge.publishState("value", url);
      this.bridge.publishAutobinding(url);
      this.bridge.publishState("last_error", "");
      this.bridge.triggerEvent("signature_saved");
    } catch (error) {
      this.bridge.error(messageOf(error, "Unable to upload signature image."));
    } finally {
      this.isUploading = false;
      this.bridge.publishState("is_uploading", false);
      this.view?.apply(this.config, false);
    }
  }

  clearSignature(): void {
    this.clearCommitTimer();
    this.initialSignatureRevision += 1;
    this.pad?.clear();
    this.bridge.publishState("value", null);
    this.bridge.publishAutobinding(null);
    this.bridge.publishState("signature_data_url", "");
    this.bridge.publishState("is_empty", true);
    this.bridge.publishState("is_drawing", false);
    this.bridge.publishState("stroke_count", 0);
    this.bridge.publishState("last_error", "");
    this.view?.showPlaceholder(true);
    this.bridge.triggerEvent("signature_cleared");
  }

  undoLastStroke(): void {
    if (!this.pad || this.pad.isEmpty()) return;
    const data = this.pad.toData();
    data.pop();
    this.pad.clear();
    if (data.length) this.pad.fromData(data);
    this.publishDrawingState(true);
    this.scheduleCommit();
  }

  setEnabled(enabled: unknown): void {
    this.config.enabled = readBoolean({ enabled }, "enabled", true);
    if (this.config.enabled) this.pad?.on();
    else this.pad?.off();
    this.view?.apply(this.config, this.isUploading);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearCommitTimer();
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.scheduleResize);
    this.pad?.off();
    this.pad = null;
    this.view?.destroy();
    this.view = null;
    if (this.instance.data[RUNTIME_KEY] === this) this.instance.data[RUNTIME_KEY] = null;
  }

  private ensureView(): void {
    if (this.view) return;
    this.view = new SignatureView(this.instance, {
      undo: () => this.undoLastStroke(),
      clear: () => this.clearSignature(),
      save: () => { void this.saveSignature(); },
    });
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.scheduleResize);
      this.resizeObserver.observe(this.view.stage);
    } else {
      window.addEventListener("resize", this.scheduleResize);
    }
  }

  private ensurePad(): void {
    if (this.pad || !this.view) return;
    this.pad = new SignaturePad(this.view.canvas, {
      penColor: this.config.penColor,
      minWidth: this.config.minWidth,
      maxWidth: this.config.maxWidth,
      backgroundColor: this.config.backgroundColor,
      minDistance: this.config.minDistance,
      throttle: this.config.throttleMs,
    });
    this.pad.addEventListener("beginStroke", this.handleBeginStroke);
    this.pad.addEventListener("endStroke", this.handleEndStroke);
  }

  private applyPadConfig(): void {
    if (!this.pad) return;
    this.pad.penColor = this.config.penColor;
    this.pad.minWidth = this.config.minWidth;
    this.pad.maxWidth = this.config.maxWidth;
    this.pad.backgroundColor = this.config.backgroundColor;
    this.pad.minDistance = this.config.minDistance;
    this.pad.throttle = this.config.throttleMs;
    this.setEnabled(this.config.enabled);
  }

  private readonly handleBeginStroke = (): void => {
    if (this.isDrawing) return;
    this.isDrawing = true;
    this.bridge.publishState("is_drawing", true);
    this.bridge.triggerEvent("signature_started");
  };

  private readonly handleEndStroke = (): void => {
    this.isDrawing = false;
    this.bridge.publishState("is_drawing", false);
    this.publishDrawingState(true);
    this.bridge.triggerEvent("signature_ended");
    this.scheduleCommit();
  };

  private readonly scheduleResize = (): void => {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.resizeCanvas(true), 50);
  };

  private resizeCanvas(preserve: boolean): void {
    if (!this.view) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = this.view.stage.getBoundingClientRect();
    const width = Math.max(1, Math.floor((rect.width || 1) * ratio));
    const height = Math.max(1, Math.floor((rect.height || 1) * ratio));
    let previous: PointGroup[] | null = null;

    if (this.pad && preserve && !this.pad.isEmpty()) previous = this.pad.toData();
    if (this.view.canvas.width === width && this.view.canvas.height === height) return;

    this.view.canvas.width = width;
    this.view.canvas.height = height;
    this.view.canvas.getContext("2d")?.scale(ratio, ratio);
    if (this.pad) {
      this.pad.clear();
      if (previous?.length) this.pad.fromData(previous);
    }
  }

  private exportDataUrl(): string {
    if (!this.pad || this.pad.isEmpty()) return "";
    if (this.config.outputFormat === "jpeg") {
      return this.pad.toDataURL("image/jpeg", this.config.jpegQuality);
    }
    return this.pad.toDataURL("image/png");
  }

  private publishDrawingState(triggerChanged: boolean): void {
    const empty = !this.pad || this.pad.isEmpty();
    let dataUrl = "";
    if (!empty) {
      try {
        dataUrl = this.exportDataUrl();
        this.bridge.publishState("last_error", "");
      } catch (error) {
        this.bridge.error(messageOf(error, "Unable to render signature image."));
      }
    }
    this.bridge.publishState("signature_data_url", dataUrl);
    this.bridge.publishState("is_empty", empty);
    this.bridge.publishState("stroke_count", this.pad?.toData().length ?? 0);
    this.view?.showPlaceholder(empty);
    if (triggerChanged) this.bridge.triggerEvent("signature_changed");
  }

  private scheduleCommit(): void {
    this.clearCommitTimer();
    if (this.config.commitBehavior !== "on_stroke_end" || !this.pad || this.pad.isEmpty()) return;
    this.pendingCommitTimer = setTimeout(() => { void this.saveSignature(); }, this.config.commitDelayMs);
  }

  private clearCommitTimer(): void {
    if (!this.pendingCommitTimer) return;
    clearTimeout(this.pendingCommitTimer);
    this.pendingCommitTimer = null;
  }

  private applyInitialSignature(): void {
    const source = this.config.initialSignature;
    if (!this.pad || source === this.initialSignatureKey) return;
    this.initialSignatureKey = source;
    const revision = ++this.initialSignatureRevision;
    this.pad.clear();
    this.bridge.publishState("value", null);
    this.bridge.publishAutobinding(null);

    if (!source) {
      this.publishDrawingState(false);
      return;
    }
    if (!/^data:image\//i.test(source) && /^https?:\/\//i.test(source)) {
      this.bridge.publishState("value", source);
      this.bridge.publishAutobinding(source);
    }

    void this.pad.fromDataURL(source).then(() => {
      if (revision === this.initialSignatureRevision && !this.destroyed) this.publishDrawingState(false);
    }).catch((error: unknown) => {
      if (revision === this.initialSignatureRevision && !this.destroyed) {
        this.bridge.error(messageOf(error, "Unable to load the initial signature."));
      }
    });
  }

  private fileName(): string {
    const extension = this.config.outputFormat === "jpeg" ? "jpg" : "png";
    return `${sanitizeFilePrefix(this.config.fileNamePrefix)}-${Date.now()}.${extension}`;
  }

  private async uploadDataUrl(dataUrl: string, context: BubbleContext): Promise<string> {
    const fileName = this.fileName();
    if (typeof this.instance.uploadFile === "function") {
      try {
        return await this.uploadWithInstance(dataUrlToFile(dataUrl, fileName));
      } catch {
        return this.uploadWithContext(dataUrl, context, fileName);
      }
    }
    return this.uploadWithContext(dataUrl, context, fileName);
  }

  private uploadWithInstance(file: Blob & { name?: string }): Promise<string> {
    return new Promise((resolve, reject) => {
      const upload = this.instance.uploadFile;
      if (typeof upload !== "function") return reject(new Error("instance.uploadFile is not available."));
      let settled = false;
      const done: UploadCallback = (error, url) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve(url || "");
      };
      try {
        const result = upload.length <= 2
          ? (upload as (file: Blob, callback: UploadCallback) => unknown)(file, done)
          : (upload as (name: string, file: Blob, callback: UploadCallback) => unknown)(file.name || "signature", file, done);
        if (result && typeof (result as Promise<string>).then === "function") {
          void (result as Promise<string>).then((url) => done(null, url), done);
        } else if (typeof result === "string") {
          done(null, result);
        }
      } catch (error) {
        done(error);
      }
    });
  }

  private uploadWithContext(dataUrl: string, context: BubbleContext, fileName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof context?.uploadContent !== "function") {
        reject(new Error("No Bubble file upload utility is available."));
        return;
      }
      try {
        context.uploadContent(fileName, dataUrlToBase64(dataUrl), (error, url) => {
          if (error) reject(error);
          else resolve(url || "");
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function dataUrlToFile(dataUrl: string, fileName: string): Blob & { name?: string; lastModified?: number } {
  const [meta = "", base64 = ""] = dataUrl.split(",", 2);
  const mime = /data:([^;]+);base64/i.exec(meta)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  try {
    return new File([bytes], fileName, { type: mime });
  } catch {
    const blob = new Blob([bytes], { type: mime }) as Blob & { name?: string; lastModified?: number };
    blob.name = fileName;
    blob.lastModified = Date.now();
    return blob;
  }
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
