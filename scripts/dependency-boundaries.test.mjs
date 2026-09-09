import assert from "node:assert/strict";
import test from "node:test";

import {
  findDependencyCycles,
  validateImport,
  validateSource,
  workspaceDirectoriesFromManifest,
} from "./dependency-boundaries-core.mjs";

test("shared package cannot import an app", () => {
  assert.deepEqual(
    validateImport("packages/tabletop/src/react/surface.tsx", "@pbdh/player"),
    ["shared packages must not depend on apps"],
  );
});

test("backend cannot import React", () => {
  assert.deepEqual(
    validateImport("apps/backend/src/server.ts", "react"),
    ["backend must not depend on React or browser entry points"],
  );
});

test("Platform Shell is the only frontend app-to-app composition seam", () => {
  assert.deepEqual(
    validateImport("apps/platform/src/PlatformApp.tsx", "@pbdh/player/surface"),
    [],
  );
  assert.deepEqual(
    validateImport("apps/player/src/PlayerSheetSurface.tsx", "@pbdh/market"),
    ["frontend app surfaces must not depend on the Platform Shell or peer apps"],
  );
  assert.deepEqual(
    validateImport("apps/platform/src/PlatformApp.tsx", "@pbdh/backend"),
    ["Platform Shell may compose only Player, Creator, and Market app surfaces"],
  );
});

test("core entry points reject frontend dependencies", () => {
  assert.deepEqual(
    validateImport("packages/templates/src/core/schema.ts", "react"),
    ["templates/core must remain frontend-free"],
  );
  assert.deepEqual(
    validateImport("packages/tabletop/src/core/commands.ts", "@pbdh/tabletop/react"),
    ["tabletop/core must remain React-free"],
  );
  assert.deepEqual(
    validateImport("packages/platform-auth/src/core/session.ts", "@pbdh/platform-auth/provider"),
    ["platform-auth/core must remain React-provider-free"],
  );
});

test("renderer cannot reverse-import the template registry", () => {
  assert.deepEqual(
    validateImport("packages/resource-renderer/src/index.ts", "@pbdh/templates/core"),
    ["resource-renderer must receive resolved templates by injection"],
  );
});

test("conversion may import templates core but not frontend", () => {
  assert.deepEqual(
    validateImport("packages/resource-conversion/src/index.ts", "@pbdh/templates/core"),
    [],
  );
  assert.deepEqual(
    validateImport("packages/resource-conversion/src/index.ts", "@pbdh/templates/frontend"),
    ["resource-conversion may depend on templates/core only"],
  );
});

test("apps load Template frontend implementations through the lazy entry only", () => {
  assert.deepEqual(validateImport("apps/player/src/preview.tsx", "@pbdh/templates/frontend/lazy"), []);
  assert.deepEqual(validateImport("apps/player/src/preview.tsx", "@pbdh/templates/frontend"),
    ["apps must load Template frontends through the lazy entry"]);
  assert.deepEqual(validateImport("apps/player/src/preview.tsx", "../../../packages/templates/src/frontend/renderer-registry.ts"),
    ["apps must load Template frontends through the lazy entry"]);
});

test("conversion cannot reverse-resolve the global template registry", () => {
  assert.deepEqual(
    validateSource(
      "packages/resource-conversion/src/template-validation.ts",
      'import { templateRegistry } from "@pbdh/templates/core";',
    ),
    ["resource-conversion must receive or explicitly target Template capabilities instead of resolving the global registry"],
  );
  assert.deepEqual(
    validateSource(
      "packages/resource-conversion/src/template-mapping.ts",
      'import { adversaryTemplate } from "@pbdh/templates/core";',
    ),
    [],
  );
});

test("workspace scan derives every workspace from the root manifest", () => {
  const workspaces = workspaceDirectoriesFromManifest({
    workspaces: ["apps/platform", "packages/cloud-documents"],
  });
  assert.deepEqual(workspaces, ["apps/platform", "packages/cloud-documents"]);
  assert.throws(
    () => workspaceDirectoriesFromManifest({ workspaces: "packages/*" }),
    /string array/,
  );
});

test("dependency graph reports shared-package cycles", () => {
  const graph = new Map([
    ["@pbdh/templates", new Set(["@pbdh/resource-renderer"])],
    ["@pbdh/resource-renderer", new Set(["@pbdh/templates"])],
  ]);
  assert.deepEqual(findDependencyCycles(graph), [[
    "@pbdh/templates",
    "@pbdh/resource-renderer",
    "@pbdh/templates",
  ]]);
});
