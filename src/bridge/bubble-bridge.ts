import type { BubbleElementInstance } from "../bubble/types";

export class BubbleBridge {
  constructor(private readonly instance: BubbleElementInstance) {}

  publishState(name: string, value: unknown): void {
    try {
      this.instance.publishState?.(name, value);
    } catch {
      // Bubble can reject late state writes while the element is tearing down.
    }
  }

  publishAutobinding(value: unknown): void {
    try {
      this.instance.publishAutobinding?.(value);
    } catch {
      // Autobinding is unavailable when the element is not bound as an input.
    }
  }

  triggerEvent(name: string): void {
    try {
      this.instance.triggerEvent?.(name);
    } catch {
      // Bubble page transitions can race with event delivery.
    }
  }

  publishInitialState(): void {
    this.publishState("value", null);
    this.publishState("signature_data_url", "");
    this.publishState("is_empty", true);
    this.publishState("is_drawing", false);
    this.publishState("is_uploading", false);
    this.publishState("stroke_count", 0);
    this.publishState("last_error", "");
  }

  error(message: string): void {
    this.publishState("last_error", message);
    if (message) this.triggerEvent("signature_error");
  }
}
