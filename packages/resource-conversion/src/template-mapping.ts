import {
  adversaryTemplate,
  temporaryAncestryTemplate,
  temporaryCommunityTemplate,
  temporaryDomainTemplate,
  temporaryEnvironmentTemplate,
  freeTemplate,
  templateRegistry,
  temporaryArmorTemplate,
  temporaryItemTemplate,
  temporaryProfessionTemplate,
  temporarySubclassTemplate,
  weaponTemplateV2,
} from "@pbdh/templates/core";

import { isObject, text } from "./shared.ts";
import { validateTemplateData } from "./template-validation.ts";
import type { ConversionDiagnostic, GameResourceCandidate, JsonObject, JsonValue, TemporaryResource } from "./types.ts";

function adversaryFeature(value: JsonValue): JsonObject {
  const item = isObject(value) ? value : {};
  return {
    名称: text(item.名称),
    原名: text(item.原名),
    类型: text(item.类型 || "被动"),
    特性描述: text(item.特性描述 || item.描述),
  };
}

function templateData(resource: TemporaryResource): { id: string; version: string; data: JsonObject } | undefined {
  if (resource.kind === "adversary") {
    const data = structuredClone(adversaryTemplate.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) {
      if (resource.fields[key] !== undefined) data[key] = resource.fields[key]!;
    }
    data.名称 = resource.name;
    data.特性 = Array.isArray(resource.fields.特性) ? resource.fields.特性.map(adversaryFeature) : [];
    return { id: adversaryTemplate.id, version: adversaryTemplate.version, data };
  }
  if (resource.kind === "weapon") {
    const data = structuredClone(weaponTemplateV2.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) data[key] = text(resource.fields[key] ?? data[key]);
    data.名称 = resource.name;
    return { id: weaponTemplateV2.id, version: weaponTemplateV2.version, data };
  }
  if (resource.kind === "armor") {
    const data = structuredClone(temporaryArmorTemplate.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) data[key] = text(resource.fields[key] ?? data[key]);
    data.名称 = resource.name;
    return { id: temporaryArmorTemplate.id, version: temporaryArmorTemplate.version, data };
  }
  if (resource.kind === "item") {
    const data = structuredClone(temporaryItemTemplate.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) data[key] = text(resource.fields[key] ?? data[key]);
    data.名称 = resource.name;
    return { id: temporaryItemTemplate.id, version: temporaryItemTemplate.version, data };
  }
  if (resource.kind === "class") {
    const data = structuredClone(temporaryProfessionTemplate.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) {
      const value = resource.fields[key];
      if (Array.isArray(data[key])) data[key] = Array.isArray(value) ? value.map(text).filter(Boolean) : [];
      else if (isObject(data[key])) data[key] = isObject(value)
        ? Object.fromEntries(Object.entries(value).map(([name, item]) => [name, text(item)]))
        : {};
      else data[key] = text(value ?? data[key]);
    }
    data.名称 = resource.name;
    return { id: temporaryProfessionTemplate.id, version: temporaryProfessionTemplate.version, data };
  }
  if (resource.kind === "subclass") {
    const data = structuredClone(temporarySubclassTemplate.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) data[key] = text(resource.fields[key] ?? data[key]);
    data.名称 = resource.name;
    return { id: temporarySubclassTemplate.id, version: temporarySubclassTemplate.version, data };
  }
  if (resource.kind === "ancestry") {
    const data = structuredClone(temporaryAncestryTemplate.defaultData) as unknown as JsonObject;
    data.名称 = resource.name;
    data.简介 = text(resource.fields.简介);
    data.特性 = Array.isArray(resource.fields.特性) ? resource.fields.特性.map((value) => {
      const feature = isObject(value) ? value : {};
      return { 名称: text(feature.名称), 描述: text(feature.描述) };
    }) : [];
    return { id: temporaryAncestryTemplate.id, version: temporaryAncestryTemplate.version, data };
  }
  if (resource.kind === "community") {
    const feature = isObject(resource.fields.特性) ? resource.fields.特性 : {};
    const data: JsonObject = {
      名称: resource.name,
      简介: text(resource.fields.简介),
      性格: text(resource.fields.性格),
      特性: { 名称: text(feature.名称), 描述: text(feature.描述) },
    };
    return { id: temporaryCommunityTemplate.id, version: temporaryCommunityTemplate.version, data };
  }
  if (resource.kind === "domain") {
    const data = structuredClone(temporaryDomainTemplate.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) data[key] = text(resource.fields[key] ?? data[key]);
    data.名称 = resource.name;
    return { id: temporaryDomainTemplate.id, version: temporaryDomainTemplate.version, data };
  }
  if (resource.kind === "environment") {
    const data = structuredClone(temporaryEnvironmentTemplate.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) {
      if (key !== "特性") data[key] = text(resource.fields[key] ?? data[key]);
    }
    data.名称 = resource.name;
    data.特性 = Array.isArray(resource.fields.特性) ? resource.fields.特性.map((value) => {
      const feature = isObject(value) ? value : {};
      return {
        名称: text(feature.名称), 类型: text(feature.类型),
        描述: text(feature.描述 || feature.特性描述), 引导问题: text(feature.引导问题 || feature.问题),
      };
    }) : [];
    return { id: temporaryEnvironmentTemplate.id, version: temporaryEnvironmentTemplate.version, data };
  }
  if (resource.kind === "free" && Array.isArray(resource.fields.内容)) {
    const data: JsonObject = {
      名称: resource.name,
      类型: text(resource.fields.类型),
      简介: text(resource.fields.简介),
      内容: resource.fields.内容.map((value) => {
        const block = isObject(value) ? value : {};
        return { 标题: text(block.标题), 正文: text(block.正文) };
      }),
    };
    return { id: freeTemplate.id, version: freeTemplate.version, data };
  }
  return undefined;
}

export function mapTemporaryResourceToCandidate(resource: TemporaryResource): GameResourceCandidate | undefined {
  const mapped = templateData(resource);
  if (!mapped) return undefined;
  if (!templateRegistry.resolve(mapped.id, mapped.version)) throw new Error(`Template not registered: ${mapped.id}@${mapped.version}`);
  const diagnostics: ConversionDiagnostic[] = validateTemplateData(mapped.id, mapped.version, mapped.data);
  return { sourceId: resource.sourceId, template: { id: mapped.id, version: mapped.version }, data: mapped.data, diagnostics };
}

export function mapBatchToRegisteredCandidates(resources: readonly TemporaryResource[]): {
  candidates: GameResourceCandidate[];
  unmapped: TemporaryResource[];
} {
  const candidates: GameResourceCandidate[] = [];
  const unmapped: TemporaryResource[] = [];
  for (const resource of resources) {
    const candidate = mapTemporaryResourceToCandidate(resource);
    if (candidate) candidates.push(candidate);
    else unmapped.push(resource);
  }
  return { candidates, unmapped };
}
