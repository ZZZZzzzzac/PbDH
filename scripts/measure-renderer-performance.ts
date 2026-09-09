import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { renderToStaticMarkup } from "react-dom/server";
import { build, type Rollup } from "vite";

import { prepareCanonicalSurface, type ManagedAsset } from "../packages/resource-renderer/src/core.ts";
import type { AdversaryData } from "../packages/templates/src/core/index.ts";
import { adversaryRendererFor } from "../packages/templates/src/frontend/index.ts";

const root = process.cwd();
const fixture = JSON.parse(readFileSync(path.join(
  root,
  "contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json",
), "utf8")) as {
  assets: Array<{ id: string }>;
  resources: Array<{
    template: { id: string; version: string };
    presentation: { mode: "text" | "split" | "image"; fixedRatio: boolean };
    data: AdversaryData;
    media: Record<string, string>;
  }>;
};
const resource = fixture.resources[0]!;
const assetId = fixture.assets[0]!.id;
const assetBytes = readFileSync(path.join(
  root,
  "contracts/conformance/resource-package/1.0.0/media",
  `${assetId.replace("sha256:", "")}.webp`,
));
const assets = new Map<string, ManagedAsset>([[assetId, { status: "ready", url: "asset://minotaur" }]]);
const renderer = adversaryRendererFor(resource.template.version);
const prepared = prepareCanonicalSurface({
  resource,
  expectedRendererRevision: renderer.revision,
  renderer,
  assets,
});
if (prepared.status !== "ready") throw new Error(JSON.stringify(prepared.diagnostics));

renderToStaticMarkup(prepared.renderer.render(prepared.renderInput));
const renderDurations = Array.from({ length: 60 }, () => {
  const started = performance.now();
  renderToStaticMarkup(prepared.renderer.render(prepared.renderInput));
  return performance.now() - started;
}).sort((left, right) => left - right);

const bundleResult = await build({
  root: path.join(root, "apps/platform"),
  configFile: path.join(root, "apps/platform/vite.config.ts"),
  logLevel: "silent",
  build: {
    write: false,
    minify: true,
  },
});
const rollupOutputs = (Array.isArray(bundleResult) ? bundleResult : [bundleResult]) as Rollup.RollupOutput[];
const chunks = rollupOutputs.flatMap((output) => output.output)
  .filter((item): item is Rollup.OutputChunk => item.type === "chunk");
const chunksByName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
const initialNames = new Set<string>();
const pending = chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName);
while (pending.length > 0) {
  const name = pending.pop()!;
  if (initialNames.has(name)) continue;
  initialNames.add(name);
  pending.push(...(chunksByName.get(name)?.imports ?? []));
}
const initialChunks = chunks.filter((chunk) => initialNames.has(chunk.fileName));
function templateModules(selected: Rollup.OutputChunk[], component: "renderer" | "authoring-editor" | "capability"): string[] {
  const directory = component === "capability" ? "core" : "frontend";
  const extension = component === "capability" ? "ts" : "tsx";
  const pattern = new RegExp(`/templates/src/${directory}/([^/]+)/([^/]+)/${component}\\.${extension}(?:\\?|$)`);
  return [...new Set(selected.flatMap((chunk) => Object.keys(chunk.modules).flatMap((id) => {
    const match = id.replaceAll("\\", "/").match(pattern);
    return match ? [`${match[1]}@${match[2]}`] : [];
  })))].sort();
}
const metrics = {
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  ssr: {
    template: resource.template,
    samples: renderDurations.length,
    warmups: 1,
    singleSurfaceRenderMsP95: Number(renderDurations[Math.floor(renderDurations.length * 0.95)]!.toFixed(3)),
  },
  productionBuild: {
    initialJavaScriptBytes: initialChunks.reduce((total, chunk) => total + Buffer.byteLength(chunk.code), 0),
    initialJavaScriptGzipBytes: initialChunks.reduce((total, chunk) => total + gzipSync(Buffer.from(chunk.code)).byteLength, 0),
    initialRendererVersions: templateModules(initialChunks, "renderer"),
    initialEditorVersions: templateModules(initialChunks, "authoring-editor"),
    initialCoreVersions: templateModules(initialChunks, "capability"),
    allRendererVersions: templateModules(chunks, "renderer"),
    allEditorVersions: templateModules(chunks, "authoring-editor"),
    allCoreVersions: templateModules(chunks, "capability"),
  },
  fixtureMediaFileBytes: assetBytes.byteLength,
};

if (metrics.productionBuild.allRendererVersions.length === 0
  || metrics.productionBuild.allCoreVersions.length === 0 || initialChunks.length === 0) {
  throw new Error("Platform production bundle measurement is empty");
}
if (!Number.isFinite(metrics.ssr.singleSurfaceRenderMsP95) || metrics.ssr.singleSurfaceRenderMsP95 < 0) {
  throw new Error("Single Surface render measurement is invalid");
}

console.log(JSON.stringify(metrics));
if (metrics.productionBuild.initialRendererVersions.length || metrics.productionBuild.initialEditorVersions.length) {
  throw new Error("Template renderers and editors must not be in the initial Platform import closure");
}
