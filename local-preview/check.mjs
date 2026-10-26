#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const previewRoot = path.dirname(fileURLToPath(import.meta.url));
const config = await readJson(path.join(previewRoot, "preview.config.json"));
if (config.version !== 1) {
  throw new Error("preview.config.json must use version 1.");
}
if (!Array.isArray(config.elements) || config.elements.length === 0) {
  throw new Error("preview.config.json must declare at least one element.");
}

for (const element of config.elements) {
  if (!element.lifecycle?.initialize) {
    throw new Error(`${element.display} is missing lifecycle.initialize.`);
  }
  for (const [kind, relativeFilename] of Object.entries(
    element.lifecycle ?? {},
  )) {
    const filename = path.resolve(previewRoot, relativeFilename);
    const source = await fs.readFile(filename, "utf8");
    let value;
    try {
      value = Function(`"use strict"; return (${source});`)();
    } catch (error) {
      throw new Error(
        `${element.display} ${kind} is not a valid function expression: ${error.message}`,
      );
    }
    if (typeof value !== "function") {
      throw new Error(`${element.display} ${kind} must evaluate to a function.`);
    }
  }
}

for (const relativeFilename of config.scenarios ?? []) {
  const scenario = await readJson(path.resolve(previewRoot, relativeFilename));
  if (!scenario.name || !scenario.element) {
    throw new Error(
      `${relativeFilename} must declare a name and element key.`,
    );
  }
  if (!config.elements.some((element) => element.key === scenario.element)) {
    throw new Error(
      `${relativeFilename} references unknown element ${scenario.element}.`,
    );
  }
}

process.stdout.write(
  `${JSON.stringify(
    {
      status: "local-visual-preview-valid",
      elements: config.elements.map((element) => element.display),
      scenarios: (config.scenarios ?? []).length,
    },
    null,
    2,
  )}\n`,
);

async function readJson(filename) {
  return JSON.parse(await fs.readFile(filename, "utf8"));
}
