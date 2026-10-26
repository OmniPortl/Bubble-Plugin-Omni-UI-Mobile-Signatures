import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";

const root = path.resolve(import.meta.dirname, "..");
const files = {
  initialize: "dist/element_source/initialize.js",
  update: "dist/element_source/update.js",
  preview: "dist/element_source/preview.js",
  reset: "dist/element_source/reset.js",
  clear: "dist/action_runs/clear-signature.js",
  setEnabled: "dist/action_runs/set-enabled.js",
};

const sources = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([name, file]) => [name, await readFile(path.join(root, file), "utf8")]),
));

for (const [name, source] of Object.entries(sources)) {
  assertFunctionExpression(name, source);
}

const dom = new JSDOM("<!doctype html><html><body><div id='host'></div><div id='preview'></div></body></html>", {
  pretendToBeVisual: true,
  runScripts: "outside-only",
});
const { window } = dom;
installCanvasMock(window);
window.ResizeObserver = class {
  observe() {}
  disconnect() {}
};

const host = window.document.getElementById("host");
host.getBoundingClientRect = () => rect(420, 220);
const states = new Map();
const events = [];
const instance = {
  canvas: {
    0: host,
    empty() { host.innerHTML = ""; },
  },
  data: {},
  publishState(name, value) { states.set(name, value); },
  publishAutobinding(value) { states.set("autobinding", value); },
  triggerEvent(name) { events.push(name); },
};
const context = { uploadContent(_name, _content, callback) { callback(null, "//example.com/signature.png"); } };
const evaluate = (source) => vm.runInContext(`(${source})`, dom.getInternalVMContext());

const initialize = evaluate(sources.initialize);
const update = evaluate(sources.update);
const clear = evaluate(sources.clear);
const setEnabled = evaluate(sources.setEnabled);
const reset = evaluate(sources.reset);

initialize(instance, context);
assert.ok(instance.data.omniSignatureRuntime, "initialize stores one persistent runtime");
update(instance, { placeholder_text: "Please sign", show_toolbar: true }, context);
assert.equal(host.querySelector(".omni-signature-placeholder")?.textContent, "Please sign");
assert.equal(host.querySelectorAll("button").length, 3);
assert.equal(states.get("is_empty"), true);

update(instance, { placeholder_text: "Updated label", show_toolbar: false }, context);
assert.equal(host.querySelector(".omni-signature-placeholder")?.textContent, "Updated label");
assert.equal(host.querySelector(".omni-signature-toolbar")?.style.display, "none");

setEnabled(instance, { enabled: false }, context);
assert.equal(host.querySelector("canvas")?.style.pointerEvents, "none");
clear(instance, {}, context);
assert.ok(events.includes("signature_cleared"));
assert.equal(states.get("signature_data_url"), "");

reset(instance, context);
assert.equal(instance.data.omniSignatureRuntime, null);
assert.equal(host.querySelector(".omni-signature-root"), null);

const previewHost = window.document.getElementById("preview");
const previewInstance = {
  canvas: { 0: previewHost, empty() { previewHost.innerHTML = ""; } },
  data: {}, publishState() {}, triggerEvent() {},
};
evaluate(sources.preview)(previewInstance, { placeholder_text: "Editor preview" });
assert.match(previewHost.textContent, /Editor preview/);

console.log(`Compiled Bubble artifact smoke passed (${Object.keys(sources).length} functions).`);

function assertFunctionExpression(name, source) {
  assert.doesNotMatch(source, /^\s*(import|export)\s/m);
  assert.doesNotMatch(source, /\brequire\s*\(|sourceMappingURL/);
  const script = new vm.Script(`(${source})`);
  assert.equal(typeof script.runInNewContext({}), "function", `${name} must be one function expression`);
}

function rect(width, height) {
  return { x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON() { return {}; } };
}

function installCanvasMock(targetWindow) {
  const context = {
    clearRect() {}, fillRect() {}, drawImage() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    quadraticCurveTo() {}, bezierCurveTo() {}, arc() {}, fill() {}, stroke() {}, scale() {}, save() {}, restore() {},
    setTransform() {}, resetTransform() {},
    globalCompositeOperation: "source-over", fillStyle: "#000", strokeStyle: "#000", lineWidth: 1,
    lineCap: "round", lineJoin: "round",
  };
  Object.defineProperty(targetWindow.HTMLCanvasElement.prototype, "getContext", { value() { return context; } });
  Object.defineProperty(targetWindow.HTMLCanvasElement.prototype, "toDataURL", { value(type = "image/png") { return `data:${type};base64,c2lnbmF0dXJl`; } });
  Object.defineProperty(targetWindow.HTMLCanvasElement.prototype, "getBoundingClientRect", { value() { return rect(420, 164); } });
}
