import type { BubbleContext, BubbleElementInstance } from "./bubble/types";
import { RUNTIME_KEY, SignatureRuntime, type SignatureRuntimeApi } from "./runtime/signature-runtime";

export function initialize(instance: BubbleElementInstance, context: BubbleContext): void {
  instance.data ||= {};
  const previous = instance.data[RUNTIME_KEY] as SignatureRuntimeApi | undefined;
  previous?.destroy?.();
  instance.data[RUNTIME_KEY] = new SignatureRuntime(instance, context || {});
}
