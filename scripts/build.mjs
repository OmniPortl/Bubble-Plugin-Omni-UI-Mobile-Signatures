import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const lifecycleDir = path.join(dist, "element_source");
const actionsDir = path.join(dist, "action_runs");

await rm(dist, { recursive: true, force: true });
await mkdir(lifecycleDir, { recursive: true });
await mkdir(actionsDir, { recursive: true });

const runtimeBundle = await bundle(path.join(root, "src", "entry.ts"), "OmniSignatureBundle");
const previewBundle = await bundle(path.join(root, "src", "preview.ts"), "OmniSignaturePreviewBundle");

const outputs = new Map();
outputs.set(
  "element_source/initialize.js",
  `function(instance, context) {\n${indent(runtimeBundle, 2)}\n  OmniSignatureBundle.initialize(instance, context || {});\n}\n`,
);
outputs.set(
  "element_source/update.js",
  wrapper(`var runtime = instance.data && instance.data.omniSignatureRuntime;
  if (runtime && typeof runtime.update === "function") {
    runtime.update(properties || {}, context || {});
  }`),
);
outputs.set(
  "element_source/reset.js",
  `function(instance, context) {\n  var runtime = instance.data && instance.data.omniSignatureRuntime;\n  if (runtime && typeof runtime.destroy === "function") {\n    runtime.destroy();\n  }\n  if (instance.data) {\n    instance.data.omniSignatureRuntime = null;\n  }\n}\n`,
);
outputs.set(
  "element_source/preview.js",
  `function(instance, properties) {\n${indent(previewBundle, 2)}\n  OmniSignaturePreviewBundle.preview(instance, properties || {});\n}\n`,
);
outputs.set(
  "action_runs/save-signature.js",
  wrapper(`var runtime = instance.data && instance.data.omniSignatureRuntime;
  if (runtime && typeof runtime.saveSignature === "function") {
    runtime.saveSignature(context || {});
  }`),
);
outputs.set(
  "action_runs/clear-signature.js",
  wrapper(`var runtime = instance.data && instance.data.omniSignatureRuntime;
  if (runtime && typeof runtime.clearSignature === "function") {
    runtime.clearSignature();
  }`),
);
outputs.set(
  "action_runs/undo-last-stroke.js",
  wrapper(`var runtime = instance.data && instance.data.omniSignatureRuntime;
  if (runtime && typeof runtime.undoLastStroke === "function") {
    runtime.undoLastStroke();
  }`),
);
outputs.set(
  "action_runs/set-enabled.js",
  wrapper(`var runtime = instance.data && instance.data.omniSignatureRuntime;
  if (runtime && typeof runtime.setEnabled === "function") {
    var enabled = properties && properties.enabled;
    if (typeof enabled === "function") {
      try { enabled = enabled(); } catch (_error) { enabled = true; }
    }
    runtime.setEnabled(enabled);
  }`),
);

for (const [relativePath, content] of outputs) {
  await writeFile(path.join(dist, relativePath), content);
}

await writeFile(
  path.join(dist, "build-manifest.json"),
  `${JSON.stringify({
    version: 1,
    target: "browser",
    format: "iife",
    dependency: "signature_pad@5.1.3 (bundled)",
    files: [...outputs].map(([file, content]) => ({
      file,
      bytes: Buffer.byteLength(content),
      sha256: createHash("sha256").update(content).digest("hex"),
    })),
  }, null, 2)}\n`,
);

function wrapper(body) {
  return `function(instance, properties, context) {\n  ${body}\n}\n`;
}

async function bundle(entryPoint, globalName) {
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: "browser",
    format: "iife",
    globalName,
    target: ["es2020"],
    write: false,
    legalComments: "none",
    sourcemap: false,
    minify: false,
    logLevel: "silent",
  });
  return result.outputFiles[0].text.trimEnd().replace(/[ \t]+$/gm, "");
}

function indent(value, spaces) {
  const prefix = " ".repeat(spaces);
  return value.split("\n").map((line) => line ? `${prefix}${line}` : "").join("\n");
}
