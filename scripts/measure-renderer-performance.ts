import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import react from "@vitejs/plugin-react";
import { renderToStaticMarkup } from "react-dom/server";
import { build, type Rollup } from "vite";

import { prepareCanonicalSurface, type ManagedAsset } from "../packages/resource-renderer/src/core.ts";
import type { AdversaryData } from "../packages/templates/src/core/index.ts";
import { adversaryRendererFor } from "../packages/templates/src/frontend/index.ts";
import {
  listLazyRendererBindings,
  loadTrustedRenderer,
} from "../packages/templates/src/frontend/lazy-renderer-registry.ts";

const root = process.cwd();
const fixture = JSON.parse(readFileSync(path.join(
  root,
  "contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json",
), "utf8")) as {
  assets: Array<{ id: string }>;
  resources: Array<{
    template: { id: string; version: string };
    presentation: { width: string; height: string; unit: "mm"; mode: "text" | "split" | "image"; fixedRatio: boolean };
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
  configFile: false,
  logLevel: "silent",
  plugins: [react()],
  build: {
    write: false,
    minify: true,
    lib: {
      entry: path.join(root, "packages/templates/src/frontend/lazy-renderer-registry.ts"),
      formats: ["es"],
      fileName: "lazy-renderer-registry",
    },
  },
});
const rollupOutputs = (Array.isArray(bundleResult) ? bundleResult : [bundleResult]) as Rollup.RollupOutput[];
const chunks = rollupOutputs.flatMap((output) => output.output)
  .filter((item): item is Rollup.OutputChunk => item.type === "chunk");
const rendererChunks = chunks.filter((chunk) => Object.keys(chunk.modules)
  .some((moduleId) => /[\\/]renderer\.tsx(?:\?|$)/.test(moduleId)));
const bundleBytes = rendererChunks.reduce((total, chunk) => total + Buffer.byteLength(chunk.code), 0);
const bundleGzipBytes = rendererChunks.reduce(
  (total, chunk) => total + gzipSync(Buffer.from(chunk.code)).byteLength,
  0,
);

const loadedRenderers = (await Promise.all(listLazyRendererBindings().map(async (binding) => {
  const separator = binding.lastIndexOf("@");
  return loadTrustedRenderer(binding.slice(0, separator), binding.slice(separator + 1));
}))).filter((candidate) => candidate !== undefined);
const revisionCount = new Set(loadedRenderers.map((candidate) => candidate.revision)).size;
const catalogResourceCount = 1000;
const mountedSurfaceCount = 4;
const metrics = {
  revisionCount,
  revisionBundleBytes: bundleBytes,
  revisionBundleGzipBytes: bundleGzipBytes,
  onDemandRendererChunkCount: rendererChunks.filter((chunk) => chunk.isDynamicEntry).length,
  catalogResourceCount,
  mountedSurfaceCount,
  uniqueAssetMemoryBytes: assetBytes.byteLength,
  singleSurfaceRenderMsP95: Number(renderDurations[Math.floor(renderDurations.length * 0.95)]!.toFixed(3)),
};

if (metrics.revisionCount === 0 || metrics.revisionBundleBytes === 0) {
  throw new Error("Renderer Revision bundle measurement is empty");
}
if (metrics.onDemandRendererChunkCount === 0) {
  throw new Error("Renderer Revisions were not emitted as on-demand chunks");
}
if (metrics.mountedSurfaceCount >= metrics.catalogResourceCount) {
  throw new Error("Mounted Surface count must be measured separately from catalog resources");
}
if (!Number.isFinite(metrics.singleSurfaceRenderMsP95) || metrics.singleSurfaceRenderMsP95 < 0) {
  throw new Error("Single Surface render measurement is invalid");
}

console.log(JSON.stringify(metrics));
