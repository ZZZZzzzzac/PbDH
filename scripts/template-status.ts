import { readFileSync } from "node:fs";

import { currentTemplates, templateRegistry } from "@pbdh/templates/core";
import { trustedAuthoringFor, trustedRendererFor } from "@pbdh/templates/frontend";

type CatalogEntry = {
  id: string;
  version: string;
  state: string;
  publication: { development: boolean; production: boolean };
};

const catalog = JSON.parse(readFileSync("packages/templates/catalog.json", "utf8")) as {
  templates: CatalogEntry[];
};

console.table(catalog.templates.map((entry) => {
  const hasAuthoring = Boolean(trustedAuthoringFor(entry.id, entry.version));
  const hasRenderer = Boolean(trustedRendererFor(entry.id, entry.version));
  const isCurrent = currentTemplates.some((template) => (
    template.id === entry.id && template.version === entry.version
  ));
  return {
    模板: entry.id,
    版本: entry.version,
    用途: isCurrent ? "当前新内容" : "兼容旧内容",
    核心: templateRegistry.resolve(entry.id, entry.version) ? "是" : "否",
    编辑: hasAuthoring ? "是" : "否",
    卡面: hasRenderer ? "是" : "否",
    开发市场: entry.publication.development ? "允许" : "禁止",
    正式市场: entry.publication.production ? "允许" : "禁止",
  };
}));
