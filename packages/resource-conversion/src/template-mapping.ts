import {
  adversaryTemplate,
  ancestryTemplate,
  armorTemplate,
  communityTemplate,
  domainTemplate,
  environmentTemplate,
  freeTemplate,
  itemTemplate,
  professionTemplate,
  subclassTemplate,
  type TemplateCoreCapability,
  weaponTemplate,
} from "@pbdh/templates/core";

import { isObject, namedFeatureGroup, namedFeatures, text } from "./shared.ts";
import { validateTemplateData } from "./template-validation.ts";
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

function templateData(resource: TemporaryResource): {
  template: TemplateCoreCapability<any>;
  data: JsonObject;
} | undefined {
  if (resource.kind === "adversary") {
    const data = structuredClone(adversaryTemplate.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) {
      if (resource.fields[key] !== undefined) data[key] = resource.fields[key]!;
    }
    data.名称 = resource.name;
    data.特性 = Array.isArray(resource.fields.特性) ? resource.fields.特性.map(adversaryFeature) : [];
    return { template: adversaryTemplate, data };
  }
  if (resource.kind === "weapon") {
    const data = structuredClone(weaponTemplate.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) {
      if (key === "原文" && resource.fields[key] === undefined) delete data[key];
      else if (key === "特性原文" && resource.fields.特性原文 === undefined) delete data[key];
      else data[key] = text(resource.fields[key] ?? data[key]);
    }
    data.名称 = resource.name;
    return { template: weaponTemplate, data };
  }
  if (resource.kind === "armor") {
    const data = structuredClone(armorTemplate.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) {
      if (key === "原文" && resource.fields[key] === undefined) delete data[key];
      else if (key === "特性原文" && resource.fields.特性原文 === undefined) delete data[key];
      else data[key] = text(resource.fields[key] ?? data[key]);
    }
    data.名称 = resource.name;
    return { template: armorTemplate, data };
  }
  if (resource.kind === "item") {
    const data = structuredClone(itemTemplate.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) {
      if ((key === "原文" || key === "特性原文") && resource.fields[key] === undefined) delete data[key];
      else data[key] = text(resource.fields[key] ?? data[key]);
    }
    data.名称 = resource.name;
    return { template: itemTemplate, data };
  }
  if (resource.kind === "class") {
    const data = structuredClone(professionTemplate.defaultData) as unknown as JsonObject;
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
    return { template: professionTemplate, data };
  }
  if (resource.kind === "subclass") {
    const data = structuredClone(subclassTemplate.defaultData) as unknown as JsonObject;
    data.名称 = resource.name;
    data.类型 = text(resource.fields.类型 || data.类型);
    if (resource.fields.原文 === undefined) delete data.原文;
    else data.原文 = text(resource.fields.原文);
    data.主职 = text(resource.fields.主职);
    data.等级 = text(resource.fields.等级);
    data.施法属性 = text(resource.fields.施法属性);
    data.特性 = namedFeatures(resource.fields.特性);
    data.简介 = text(resource.fields.简介);
    return { template: subclassTemplate, data };
  }
  if (resource.kind === "ancestry") {
    const data = structuredClone(ancestryTemplate.defaultData) as unknown as JsonObject;
    data.名称 = resource.name;
    data.原文 = text(resource.fields.原文);
    data.类型 = text(resource.fields.类型 || data.类型);
    data.简介 = text(resource.fields.简介);
    data.特性 = Array.isArray(resource.fields.特性) ? resource.fields.特性.map((value) => {
      const feature = isObject(value) ? value : {};
      return { 特性名称: text(feature.特性名称), 特性原文: text(feature.特性原文), 特性描述: text(feature.特性描述) };
    }) : [];
    return { template: ancestryTemplate, data };
  }
  if (resource.kind === "community") {
    const feature = isObject(resource.fields.特性) ? resource.fields.特性 : {};
    const data: JsonObject = {
      名称: resource.name,
      ...(resource.fields.原文 === undefined ? {} : { 原文: text(resource.fields.原文) }),
      类型: text(resource.fields.类型 || communityTemplate.defaultData.类型),
      简介: text(resource.fields.简介),
      性格: text(resource.fields.性格),
      特性: { 特性名称: text(feature.特性名称), 特性原文: text(feature.特性原文), 特性描述: text(feature.特性描述) },
    };
    return { template: communityTemplate, data };
  }
  if (resource.kind === "domain") {
    const data = structuredClone(domainTemplate.defaultData) as unknown as JsonObject;
    for (const key of Object.keys(data)) {
      if ((key === "原文" || key === "特性原文") && resource.fields[key] === undefined) delete data[key];
      else data[key] = text(resource.fields[key] ?? data[key]);
    }
    data.名称 = resource.name;
    data.类型 = text(resource.fields.类型 || data.类型);
    return { template: domainTemplate, data };
  }
  if (resource.kind === "environment") {
    const data = structuredClone(environmentTemplate.defaultData) as unknown as JsonObject;
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
    return { template: environmentTemplate, data };
  }
  if (resource.kind === "free" && Array.isArray(resource.fields.内容)) {
    const data: JsonObject = {
      名称: resource.name,
      ...(resource.fields.原文 === undefined ? {} : { 原文: text(resource.fields.原文) }),
      类型: text(resource.fields.类型 || freeTemplate.defaultData.类型),
      简介: text(resource.fields.简介),
      内容: resource.fields.内容.map((value) => {
        const block = isObject(value) ? value : {};
        return { 名称: text(block.名称), 原文: text(block.原文), 描述: text(block.描述) };
      }),
    };
    return { template: freeTemplate, data };
  }
  return undefined;
}

export function mapTemporaryResourceToCandidate(resource: TemporaryResource): GameResourceCandidate | undefined {
  const mapped = templateData(resource);
  if (!mapped) return undefined;
  const { template } = mapped;
  const diagnostics: ConversionDiagnostic[] = validateTemplateData(
    template.id,
    template.version,
    mapped.data,
    template,
  );
  return {
    sourceId: resource.sourceId,
    template: { id: template.id, version: template.version },
    data: mapped.data,
    diagnostics,
  };
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
