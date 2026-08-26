import path from "node:path";

const appPackages = new Set([
  "@pbdh/platform",
  "@pbdh/player",
  "@pbdh/creator",
  "@pbdh/market",
  "@pbdh/backend",
]);

const browserPackages = new Set(["react", "react-dom", "react-dom/client"]);

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function resolveRelativeImport(importer, specifier) {
  if (!specifier.startsWith(".")) return null;
  return normalizePath(path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier)));
}

function importsPackage(specifier, packageName) {
  return specifier === packageName || specifier.startsWith(`${packageName}/`);
}

export function validateImport(importerPath, specifier) {
  const importer = normalizePath(importerPath);
  const targetPath = resolveRelativeImport(importer, specifier);
  const violations = [];
  const inSharedPackage = importer.startsWith("packages/");
  const targetsAppPackage = [...appPackages].some((packageName) => importsPackage(specifier, packageName));
  const importerApp = /^apps\/([^/]+)\//.exec(importer)?.[1];
  const targetApp = targetPath ? /^apps\/([^/]+)\//.exec(targetPath)?.[1] : undefined;
  const targetsApp = targetsAppPackage || Boolean(targetApp);
  const targetsPeerApp = targetsAppPackage || Boolean(targetApp && targetApp !== importerApp);
  const inPlatformShell = importer.startsWith("apps/platform/");
  const inLeafFrontendApp = ["apps/player/", "apps/creator/", "apps/market/"]
    .some((prefix) => importer.startsWith(prefix));

  if (inSharedPackage && targetsApp) {
    violations.push("shared packages must not depend on apps");
  }

  if (inLeafFrontendApp && targetsPeerApp) {
    violations.push("frontend app surfaces must not depend on the Platform Shell or peer apps");
  }

  if (inPlatformShell && targetsPeerApp && ![
    "@pbdh/player",
    "@pbdh/creator",
    "@pbdh/market",
  ].some((packageName) => importsPackage(specifier, packageName))) {
    violations.push("Platform Shell may compose only Player, Creator, and Market app surfaces");
  }

  if (importer.startsWith("apps/backend/") && browserPackages.has(specifier)) {
    violations.push("backend must not depend on React or browser entry points");
  }

  const inTemplatesCore = importer.startsWith("packages/templates/core/")
    || importer.startsWith("packages/templates/src/core/");
  if (inTemplatesCore && (browserPackages.has(specifier) || specifier.includes("/frontend"))) {
    violations.push("templates/core must remain frontend-free");
  }

  const inTabletopCore = importer.startsWith("packages/tabletop/core/")
    || importer.startsWith("packages/tabletop/src/core/");
  if (inTabletopCore && (browserPackages.has(specifier) || specifier.includes("/react"))) {
    violations.push("tabletop/core must remain React-free");
  }

  const inPlatformAuthCore = importer.startsWith("packages/platform-auth/core/")
    || importer.startsWith("packages/platform-auth/src/core/");
  if (inPlatformAuthCore && (browserPackages.has(specifier) || specifier.includes("/provider"))) {
    violations.push("platform-auth/core must remain React-provider-free");
  }

  if (importer.startsWith("packages/resource-renderer/")
    && importsPackage(specifier, "@pbdh/templates")) {
    violations.push("resource-renderer must receive resolved templates by injection");
  }

  if (importer.startsWith("packages/resource-conversion/")
    && specifier.startsWith("@pbdh/templates/frontend")) {
    violations.push("resource-conversion may depend on templates/core only");
  }

  return violations;
}

export function findDependencyCycles(graph) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = [];

  function visit(node) {
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      cycles.push([...stack.slice(start), node]);
      return;
    }
    if (visited.has(node)) return;

    visiting.add(node);
    stack.push(node);
    for (const dependency of graph.get(node) ?? []) visit(dependency);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) visit(node);
  return cycles;
}
