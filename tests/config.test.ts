import { describe, expect, it } from "vitest";
import { normalizeConfig, sanitizeFilePrefix } from "../src/config/signature-config";

describe("signature configuration", () => {
  it("normalizes Bubble dynamic values and clamps numeric settings", () => {
    const config = normalizeConfig({
      enabled: () => "no",
      output_format: "unexpected",
      commit_behavior: "manual",
      jpeg_quality: 4,
      min_width: -3,
      max_width: 0,
      initial_signature: { url: () => "https://example.com/signature.png" },
    });
    expect(config.enabled).toBe(false);
    expect(config.outputFormat).toBe("png");
    expect(config.commitBehavior).toBe("manual");
    expect(config.jpegQuality).toBe(1);
    expect(config.minWidth).toBe(0.1);
    expect(config.maxWidth).toBe(0.1);
    expect(config.initialSignature).toBe("https://example.com/signature.png");
  });

  it("leaves private uploads off by default", () => {
    const config = normalizeConfig({});
    expect(config.makeFilePrivate).toBe(false);
    expect(config.attachToId).toBe("");
    expect(config.attachToThing).toBeNull();
  });

  it("reads the private upload thing and its unique id", () => {
    const thing = { get: (key: string) => (key === "_id" ? " 1700000000000x1 " : undefined) };
    const config = normalizeConfig({ make_file_private: () => true, attach_to: thing });
    expect(config.makeFilePrivate).toBe(true);
    expect(config.attachToThing).toBe(thing);
    expect(config.attachToId).toBe("1700000000000x1");
    expect(normalizeConfig({ attach_to: { unique_id: "abc" } }).attachToId).toBe("abc");
    expect(normalizeConfig({ attach_to: "xyz " }).attachToId).toBe("xyz");
    expect(normalizeConfig({ attach_to: "xyz" }).attachToThing).toBeNull();
  });

  it("sanitizes uploaded file prefixes", () => {
    expect(sanitizeFilePrefix(" Client / Signature ")).toBe("Client-Signature");
    expect(sanitizeFilePrefix("***")).toBe("signature");
  });
});
