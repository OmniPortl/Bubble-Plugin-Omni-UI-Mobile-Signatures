export type BubbleProperties = Record<string, unknown>;

export interface BubbleCanvas {
  0?: HTMLElement;
  empty(): void;
  get?(index: number): HTMLElement | undefined;
}

export type UploadCallback = (error: unknown, url?: string) => void;

export interface BubbleContext {
  uploadContent?(fileName: string, base64: string, callback: UploadCallback): void;
  [key: string]: unknown;
}

export interface BubbleElementInstance {
  canvas: BubbleCanvas;
  data: Record<string, unknown>;
  publishState(name: string, value: unknown): void;
  publishAutobinding?(value: unknown): void;
  triggerEvent(name: string): void;
  uploadFile?: ((file: Blob, callback: UploadCallback) => unknown) |
    ((fileName: string, file: Blob, callback: UploadCallback) => unknown);
}
