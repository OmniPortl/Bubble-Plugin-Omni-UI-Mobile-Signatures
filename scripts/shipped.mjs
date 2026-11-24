#!/usr/bin/env node
// Keeps the files Bubble loads (elements/, actions/) in step with the build.
//
//   node scripts/shipped.mjs           copy the build output into elements/ and actions/
//   node scripts/shipped.mjs --check   exit 1 if any shipped file differs from the build
//
// bubble-plugin-builder.json lists each element by its Bubble display name and
// the build folder holding its lifecycle files (initialize.js, update.js, ...).
// The matching Bubble folder is the one whose params.json has that display name.
// When two elements share a display name (a web and a mobile version), the
// entry's "platform_type" picks the one whose params.json says the same.
// "files" (optional) lists which lifecycle files ship; without it every .js
// file in lifecycle_dir does. Element actions ("actions": { "<caption>":
// "<build file>" }) live in the element's element_actions/ and are matched by
// the caption in their params.json. Server actions ("server_actions":
// { "<display>": "<build file>" }) are matched by display name in actions/.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const check = process.argv.includes("--check");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "bubble-plugin-builder.json"), "utf8"));

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const paramsOf = (dir) => {
  const params = path.join(dir, "params.json");
  return fs.existsSync(params) ? readJson(params) : {};
};
const folderByDisplay = (parent, display, platformType) => {
  if (!fs.existsSync(parent)) return undefined;
  const hits = fs.readdirSync(parent).map((d) => path.join(parent, d)).filter((d) => {
    const params = paramsOf(d);
    if ((params.display ?? params.caption) !== display) return false;
    return platformType === undefined || params.platform_type === platformType;
  });
  if (hits.length > 1) throw new Error(`more than one folder in ${path.relative(root, parent)} is "${display}"`);
  return hits[0];
};

const pairs = []; // [built file, shipped file]
for (const element of [...(manifest.web_elements ?? []), ...(manifest.native_elements ?? [])]) {
  const target = folderByDisplay(path.join(root, "elements"), element.display, element.platform_type);
  if (!target) throw new Error(`no folder in elements/ has the display name "${element.display}"`);
  const built = path.join(root, element.lifecycle_dir);
  if (!fs.existsSync(built)) throw new Error(`${element.lifecycle_dir} is missing; run npm run build first`);
  for (const name of element.files ?? fs.readdirSync(built).filter((f) => f.endsWith(".js"))) {
    pairs.push([path.join(built, name), path.join(target, name)]);
  }
  for (const [display, file] of Object.entries(element.actions ?? {})) {
    const action = folderByDisplay(path.join(target, "element_actions"), display);
    if (!action) throw new Error(`"${element.display}" has no action named "${display}"`);
    pairs.push([path.join(root, file), path.join(action, "run.js")]);
  }
}
for (const [display, file] of Object.entries(manifest.server_actions ?? {})) {
  const action = folderByDisplay(path.join(root, "actions"), display);
  if (!action) throw new Error(`no folder in actions/ has the display name "${display}"`);
  pairs.push([path.join(root, file), path.join(action, "server.js")]);
}

let differing = 0;
for (const [from, to] of pairs) {
  const want = fs.readFileSync(from);
  const same = fs.existsSync(to) && Buffer.compare(want, fs.readFileSync(to)) === 0;
  if (same) continue;
  if (check) {
    differing += 1;
    console.error(`differs: ${path.relative(root, to)} (from ${path.relative(root, from)})`);
  } else {
    fs.writeFileSync(to, want);
    console.log(`updated ${path.relative(root, to)}`);
  }
}
if (check && differing) {
  console.error(`${differing} of ${pairs.length} shipped files differ from the build. Run npm run build && npm run ship.`);
  process.exit(1);
}
console.log(check ? `all ${pairs.length} shipped files match the build` : `${pairs.length} shipped files in step with the build`);
