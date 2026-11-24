#!/usr/bin/env node

import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const previewRoot = path.dirname(fileURLToPath(import.meta.url));
const host = argument("--host") ?? "127.0.0.1";
const requestedPort = Number(argument("--port") ?? process.env.PORT ?? 4173);
const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/runtime.js", ["runtime.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
]);

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  const server = createPreviewServer();
  server.listen(
    Number.isFinite(requestedPort) && requestedPort >= 0 ? requestedPort : 4173,
    host,
    () => {
      const address = server.address();
      const port =
        address && typeof address === "object" ? address.port : requestedPort;
      process.stdout.write(
        `${JSON.stringify({
          status: "local-visual-preview-ready",
          url: `http://${host}:${port}`,
          previewRoot,
        })}\n`,
      );
    },
  );
}

export function createPreviewServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(
        request.url ?? "/",
        `http://${request.headers.host}`,
      );
      if (url.pathname === "/api/bootstrap") {
        return sendJson(response, await loadBootstrap());
      }
      if (url.pathname === "/api/version") {
        return sendJson(response, { version: await currentVersion() });
      }
      const staticEntry = staticFiles.get(url.pathname);
      if (staticEntry) {
        const [filename, contentType] = staticEntry;
        const body = await fs.readFile(path.join(previewRoot, filename));
        response.writeHead(200, {
          "content-type": contentType,
          "cache-control": "no-store",
        });
        response.end(body);
        return;
      }
      response.writeHead(404, {
        "content-type": "text/plain; charset=utf-8",
      });
      response.end("Not found");
    } catch (error) {
      response.writeHead(500, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  });
}

export async function loadBootstrap() {
  const config = await readJson(
    path.join(previewRoot, "preview.config.json"),
  );
  if (config.version !== 1) {
    throw new Error("preview.config.json must use version 1.");
  }
  const elements = [];
  for (const element of config.elements ?? []) {
    const lifecycle = {};
    for (const kind of ["initialize", "update", "preview", "reset"]) {
      if (!element.lifecycle?.[kind]) continue;
      lifecycle[kind] = await fs.readFile(
        path.resolve(previewRoot, element.lifecycle[kind]),
        "utf8",
      );
    }
    const params = element.params
      ? await readJson(path.resolve(previewRoot, element.params))
      : {};
    elements.push({ ...element, lifecycle, params });
  }
  const scenarios = [];
  for (const filename of config.scenarios ?? []) {
    scenarios.push({
      filename,
      scenario: await readJson(path.resolve(previewRoot, filename)),
    });
  }
  return {
    config,
    elements,
    scenarios,
    version: await currentVersion(config),
  };
}

export async function currentVersion(knownConfig) {
  const config =
    knownConfig ??
    (await readJson(path.join(previewRoot, "preview.config.json")));
  const filenames = [
    path.join(previewRoot, "preview.config.json"),
    path.join(previewRoot, "runtime.js"),
    ...(config.scenarios ?? []).map((filename) =>
      path.resolve(previewRoot, filename),
    ),
    ...(config.elements ?? []).flatMap((element) => [
      ...Object.values(element.lifecycle ?? {}).map((filename) =>
        path.resolve(previewRoot, filename),
      ),
      ...(element.params
        ? [path.resolve(previewRoot, element.params)]
        : []),
    ]),
  ];
  const parts = [];
  for (const filename of filenames) {
    const stat = await fs.stat(filename);
    parts.push(`${filename}:${stat.size}:${stat.mtimeMs}`);
  }
  return parts.join("|");
}

async function readJson(filename) {
  return JSON.parse(await fs.readFile(filename, "utf8"));
}

function sendJson(response, value) {
  response.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
