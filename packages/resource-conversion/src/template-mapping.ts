import type { TemplateCoreCapability } from "@pbdh/templates/core";

import { isObject, namedFeatureGroup, namedFeatures, text } from "./shared.ts";
import { validateTemplateData } from "./template-validation.ts";
import { normalizePlainTextFields } from "./plain-text.ts";
import type { ConversionDiagnostic, GameResourceCandidate, JsonObject, JsonValue, TemporaryResource } from "./types.ts";

function adversaryFeature(value: JsonValue): JsonObject {
  const item = isObject(value) ? value : {};
  return {
    特性名称: text(item.特性名称),
    特性原文: text(item.特性原文),
    特性类型: text(item.特性类型 || "被动"),
    特性描述: text(item.特性描述),
  };
}

export function resourceTemplateId(kind: string): string | undefined {
  const ids: Record<string, string> = { adversary: "敌人", ancestry: "种族", armor: "护甲", community: "社群",
    domain: "领域卡", environment: "环境", free: "自由", item: "物品", class: "职业", subclass: "子职业", weapon: "武器" };
  return Object.hasOwn(ids, kind) ? ids[kind] : undefined;
}

function templateData(resource: TemporaryResource, template: TemplateCoreCapability<any>): {
  template: TemplateCoreCapability<any>;
  data: JsonObject;
} | undefined {
  if (resource.kind === "adversary") {
    const data = structuredClone(template.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) {
      if (resource.fields[key] !== undefined) data[key] = resource.fields[key]!;
    }
    data.名称 = resource.name;
    data.特性 = Array.isArray(resource.fields.特性) ? resource.fields.特性.map(adversaryFeature) : [];
    return { template, data };
  }
  if (resource.kind === "weapon") {
    const data = structuredClone(template.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) {
      if (key === "原文" && resource.fields[key] === undefined) delete data[key];
      else if (key === "特性原文" && resource.fields.特性原文 === undefined) delete data[key];
      else data[key] = text(resource.fields[key] ?? data[key]);
    }
    data.名称 = resource.name;
    return { template, data };
  }
  if (resource.kind === "armor") {
    const data = structuredClone(template.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) {
      if (key === "原文" && resource.fields[key] === undefined) delete data[key];
      else if (key === "特性原文" && resource.fields.特性原文 === undefined) delete data[key];
      else data[key] = text(resource.fields[key] ?? data[key]);
    }
    data.名称 = resource.name;
    return { template, data };
  }
  if (resource.kind === "item") {
    const data = structuredClone(template.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) {
      if ((key === "原文" || key === "特性原文") && resource.fields[key] === undefined) delete data[key];
      else data[key] = text(resource.fields[key] ?? data[key]);
    }
    data.名称 = resource.name;
    return { template, data };
  }
  if (resource.kind === "class") {
    const data = structuredClone(template.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) {
      const value = resource.fields[key];
      if (key === "特性") data[key] = namedFeatures(value);
      else if (key === "希望特性") data[key] = namedFeatureGroup(value);
      else if (key === "简介") data[key] = text(value);
      else if (Array.isArray(data[key])) data[key] = Array.isArray(value) ? value.map(text).filter(Boolean) : [];
      else if (isObject(data[key])) data[key] = isObject(value)
        ? Object.fromEntries(Object.entries(value).map(([name, item]) => [name, text(item)]))
        : {};
      else if (key === "原文" && value === undefined) delete data[key];
      else data[key] = text(value ?? data[key]);
    }
    data.名称 = resource.name;
    data.类型 = text(resource.fields.类型 || data.类型);
    const recommendedAttributes = resource.fields.推荐初始属性;
    data.推荐初始属性 = Object.fromEntries(["敏捷", "力量", "灵巧", "本能", "风度", "知识"].map((name) => {
      if (Array.isArray(recommendedAttributes)) {
        const entry = recommendedAttributes.find((item) => isObject(item) && Object.hasOwn(item, name));
        return [name, isObject(entry) ? text(entry[name]) : ""];
      }
      return [name, isObject(recommendedAttributes) ? text(recommendedAttributes[name]) : ""];
    }));
    const recommendedWeapons = resource.fields.推荐初始武器;
    data.推荐初始武器 = Array.isArray(recommendedWeapons)
      ? recommendedWeapons.map(text).filter(Boolean).join(" + ")
      : text(recommendedWeapons);
    return { template, data };
  }
  if (resource.kind === "subclass") {
    const data = structuredClone(template.defaultData) as unknown as JsonObject;
    data.名称 = resource.name;
    data.类型 = text(resource.fields.类型 || data.类型);
    if (resource.fields.原文 === undefined) delete data.原文;
    else data.原文 = text(resource.fields.原文);
    data.主职 = text(resource.fields.主职);
    data.等级 = text(resource.fields.等级);
    data.施法属性 = text(resource.fields.施法属性);
    data.特性 = namedFeatures(resource.fields.特性);
    data.简介 = text(resource.fields.简介);
    return { template, data };
  }
  if (resource.kind === "ancestry") {
    const data = structuredClone(template.defaultData) as unknown as JsonObject;
    data.名称 = resource.name;
    data.原文 = text(resource.fields.原文);
    data.类型 = text(resource.fields.类型 || data.类型);
    data.简介 = text(resource.fields.简介);
    data.特性 = Array.isArray(resource.fields.特性) ? resource.fields.特性.map((value) => {
      const feature = isObject(value) ? value : {};
      return { 特性名称: text(feature.特性名称), 特性原文: text(feature.特性原文), 特性描述: text(feature.特性描述) };
    }) : [];
    return { template, data };
  }
  if (resource.kind === "community") {
    const feature = isObject(resource.fields.特性) ? resource.fields.特性 : {};
    const data: JsonObject = {
      名称: resource.name,
      ...(resource.fields.原文 === undefined ? {} : { 原文: text(resource.fields.原文) }),
      类型: text(resource.fields.类型 || template.defaultData.类型),
      简介: text(resource.fields.简介),
      性格: text(resource.fields.性格),
      特性: { 特性名称: text(feature.特性名称), 特性原文: text(feature.特性原文), 特性描述: text(feature.特性描述) },
    };
    return { template, data };
  }
  if (resource.kind === "domain") {
    const data = structuredClone(template.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) {
      if ((key === "原文" || key === "特性原文") && resource.fields[key] === undefined) delete data[key];
      else data[key] = text(resource.fields[key] ?? data[key]);
    }
    data.名称 = resource.name;
    data.类型 = text(resource.fields.类型 || data.类型);
    return { template, data };
  }
  if (resource.kind === "environment") {
    const data = structuredClone(template.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) {
      if (key !== "特性") data[key] = text(resource.fields[key] ?? data[key]);
    }
    data.名称 = resource.name;
    data.类型 = text(resource.fields.类型 || data.类型);
    data.特性 = Array.isArray(resource.fields.特性) ? resource.fields.特性.map((value) => {
      const feature = isObject(value) ? value : {};
      return {
        特性名称: text(feature.特性名称), 特性原文: text(feature.特性原文), 特性类型: text(feature.特性类型),
        特性描述: text(feature.特性描述), 引导问题: text(feature.引导问题),
      };
    }) : [];
    return { template, data };
  }
  if (resource.kind === "free" && Array.isArray(resource.fields.内容)) {
    const fixedFields = new Set(Object.keys(template.defaultData));
    const customFields = Object.fromEntries(Object.entries(resource.fields)
      .filter(([key, value]) => !fixedFields.has(key) && typeof value === "string"));
    const data: JsonObject = {
      名称: resource.name,
      ...(resource.fields.原文 === undefined ? {} : { 原文: text(resource.fields.原文) }),
      类型: text(resource.fields.类型 || template.defaultData.类型),
      简介: text(resource.fields.简介),
      ...customFields,
      内容: resource.fields.内容.map((value) => {
        const block = isObject(value) ? value : {};
        return { 名称: text(block.名称), 原文: text(block.原文), 描述: text(block.描述) };
      }),
    };
    return { template, data };
  }
  return undefined;
}

export function mapTemporaryResourceToCandidate(resource: TemporaryResource, templates: readonly TemplateCoreCapability<any>[]): GameResourceCandidate | undefined {
  const id = resourceTemplateId(resource.kind);
  const selected = templates.find((template) => template.id === id);
  if (!selected) return undefined;
  const mapped = templateData(resource, selected);
  if (!mapped) return undefined;
  const { template } = mapped;
  const data = resource.source.formatId === "pbres"
    ? mapped.data
    : normalizePlainTextFields(mapped.data, resource.kind);
  if (resource.source.formatId !== "pbres" && resource.kind === "weapon") {
    data.距离 = text(data.距离).replaceAll("范围", "").trim();
  }
  const diagnostics: ConversionDiagnostic[] = validateTemplateData(
    template.id,
    template.version,
    data,
    template,
  );
  return {
    sourceId: resource.sourceId,
    template: { id: template.id, version: template.version },
    data,
    diagnostics,
  };
}

export function mapBatchToRegisteredCandidates(resources: readonly TemporaryResource[], templates: readonly TemplateCoreCapability<any>[]): {
  candidates: GameResourceCandidate[];
  unmapped: TemporaryResource[];
} {
  const candidates: GameResourceCandidate[] = [];
  const unmapped: TemporaryResource[] = [];
  for (const resource of resources) {
    const candidate = mapTemporaryResourceToCandidate(resource, templates);
    if (candidate) candidates.push(candidate);
    else unmapped.push(resource);
  }
  return { candidates, unmapped };
}
