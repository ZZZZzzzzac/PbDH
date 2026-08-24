import assert from "node:assert/strict";
import test from "node:test";

import {
  findDependencyCycles,
  validateImport,
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
