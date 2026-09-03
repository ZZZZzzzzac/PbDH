import {
  asJsonObject,
  exportFailure,
  formatNamedFeatures,
  formatNamedFeatureGroup,
  importFailure,
  isObject,
  namedFeatures,
  namedFeatureGroup,
  jsonArtifact,
  parseJson,
  report,
  safeStem,
  semanticCount,
  sourceRaw,
  splitJoined,
  text,
} from "../shared.ts";
import type {
  ConversionDiagnostic,
  ExportOptions,
  JsonObject,
  ResourceFormatAdapter,
  ResourceKind,
  TemporaryResource,
} from "../types.ts";

const upstreamRevision = "13385f4b633d35eddf6681f11d0d5c5d46ce5733";
const trailer = "||TRPG_DATA||";
const cardTypes = new Set([
  "weapon", "subweapon", "armor", "loot", "consumable", "domain", "story", "class", "subclass",
  "ancestry", "community", "npc", "calamity", "ingredient", "meal", "transformation", "material",
  "vehicle", "madness", "clue", "prophecy", "question", "quest", "wheelchair", "anomaly", "stronghold",
  "environment", "landmark",
]);
const subclassLevels = [
  { field: "foundationFeature", level: "基础" },
  { field: "advancedFeature", level: "进阶" },
  { field: "masteryFeature", level: "精通" },
] as const;
const freeTypeLabels: Record<string, string> = {
  story: "专属",
  calamity: "灾厄",
  ingredient: "食材",
  meal: "料理",
  transformation: "转变卡",
  material: "材料",
  vehicle: "载具",
  madness: "疯狂",
  clue: "线索",
  prophecy: "预言",
  question: "问题",
  quest: "任务",
  wheelchair: "战斗轮椅",
  anomaly: "异常",
  stronghold: "据点",
  landmark: "地标",
};

type FreeField = {
  field: string;
  title: string;
  itemFields?: Array<{ field: string; label: string }>;
};

const freeFields: Record<string, FreeField[]> = {
  story: [{ field: "trigger", title: "触发条件" }, { field: "effect", title: "效果" }],
  calamity: [{ field: "effect", title: "灾厄效果" }],
  ingredient: [
    { field: "flavors", title: "味型配置", itemFields: [{ field: "name", label: "味型" }, { field: "die", label: "骰子" }] },
    { field: "feature", title: "特性" },
  ],
  meal: [
    { field: "components", title: "食材构成", itemFields: [{ field: "name", label: "食材" }, { field: "die", label: "骰子" }] },
    { field: "die", title: "总对应骰" }, { field: "effect", title: "额外效果" },
  ],
  transformation: [{ field: "features", title: "转变特性", itemFields: [{ field: "name", label: "名称" }, { field: "description", label: "描述" }] }],
  material: [
    { field: "source", title: "来源" }, { field: "part", title: "部位" },
    { field: "features", title: "材料特性", itemFields: [{ field: "name", label: "名称" }, { field: "description", label: "描述" }] },
  ],
  vehicle: [
    { field: "armaments", title: "武装", itemFields: [{ field: "name", label: "名称" }, { field: "damage", label: "伤害" }] },
    { field: "features", title: "载具特性", itemFields: [{ field: "name", label: "名称" }, { field: "description", label: "描述" }] },
  ],
  madness: [{ field: "effect", title: "效果" }, { field: "cureCondition", title: "失效条件" }],
  clue: [{ field: "content", title: "内容" }, { field: "note", title: "备注" }],
  prophecy: [
    { field: "content", title: "预言内容" }, { field: "successEffect", title: "应验效果" },
    { field: "failureEffect", title: "失败效果" },
  ],
  question: [
    { field: "questionType", title: "问题类型" },
    { field: "options", title: "填写内容", itemFields: [] },
  ],
  quest: [
    { field: "questGiver", title: "任务发布者" }, { field: "dangerLevel", title: "危险等级" },
    { field: "deadline", title: "期限" }, { field: "objectives", title: "目标" }, { field: "reward", title: "奖励" },
  ],
  wheelchair: [
    { field: "frameType", title: "框架类型" }, { field: "tier", title: "位阶" },
    { field: "trait", title: "属性" }, { field: "range", title: "距离" },
    { field: "damage", title: "伤害" }, { field: "burden", title: "负荷" },
    { field: "evasionMod", title: "闪避修正" }, { field: "feature", title: "特性" },
    { field: "actions", title: "动作" }, { field: "consequences", title: "后果" },
  ],
  anomaly: [
    { field: "containmentClass", title: "收容等级" }, { field: "source", title: "发生源头" },
    { field: "procedures", title: "收容措施" }, { field: "effects", title: "异常效应" },
    { field: "drawback", title: "代价与负面后果" },
  ],
  stronghold: [{ field: "functions", title: "据点功能" }, { field: "restrictions", title: "特殊限制" }],
  landmark: [
    { field: "appearance", title: "外观" }, { field: "functions", title: "功能" }, { field: "notes", title: "特殊备注" },
  ],
};

function freeFieldBody(value: unknown, itemFields?: FreeField["itemFields"]): string {
  if (!Array.isArray(value)) return text(value);
  if (itemFields?.length === 0) return value.map(text).filter(Boolean).join("\n");
  return value.map((item) => {
    const object = isObject(item) ? item : {};
    return (itemFields ?? []).map(({ field, label }) => {
      const fieldValue = text(object[field]);
      return fieldValue ? `${label}：${fieldValue}` : "";
    }).filter(Boolean).join("；");
  }).filter(Boolean).join("\n");
}

function freeFieldsFor(raw: JsonObject, type: string): JsonObject {
  const typeLabel = freeTypeLabels[type] ?? type;
  const description = text(raw.description);
  return {
    名称: text(raw.name),
    类型: typeLabel || "自由",
    内容: [
      ...(description ? [{ 标题: "简介", 正文: description }] : []),
      ...(freeFields[type] ?? []).map(({ field, title, itemFields }) => ({
        标题: title,
        正文: freeFieldBody(raw[field], itemFields),
      })).filter((block) => block.正文),
    ],
  };
}

function subclassName(value: unknown): string {
  return text(value).replace(/[\s\-－—]*(?:基础|进阶|精通)$/u, "").trim();
}

function kindFor(type: string): ResourceKind {
  if (type === "npc") return "adversary";
  if (type === "environment") return "environment";
  if (type === "weapon" || type === "subweapon") return "weapon";
  if (type === "armor") return "armor";
  if (type === "loot" || type === "consumable") return "item";
  if (type === "class") return "class";
  if (type === "subclass") return "subclass";
  if (type === "ancestry") return "ancestry";
  if (type === "community") return "community";
  if (type === "domain") return "domain";
  return "free";
}

function fieldsFor(raw: JsonObject): JsonObject {
  const type = text(raw.type);
  if (freeTypeLabels[type]) return freeFieldsFor(raw, type);
  const common: JsonObject = {
    名称: text(raw.name),
    类型: type,
    描述: text(raw.description),
    创作者: text(raw.creator),
    所有者: text(raw.owner),
  };
  if (type === "npc") {
    return {
      ...common,
      类型: "敌人",
      简介: text(raw.description),
      难度: text(raw.difficulty),
      动机与战术: text(raw.motive),
      特性: Array.isArray(raw.features) ? raw.features.map((value) => {
        const item = isObject(value) ? value : {};
        return {
          名称: text(item.name),
          触发: text(item.trigger),
          选择: text(item.choice),
          特性描述: text(item.effect),
        };
      }) : [],
    };
  }
  if (type === "environment") {
    return {
      ...common,
      简介: text(raw.description),
      位阶: text(raw.tier),
      种类: text(raw.envType),
      趋向: text(raw.tendency),
      难度: text(raw.difficulty),
      潜在敌人: text(raw.potentialEnemies),
      特性: Array.isArray(raw.features) ? raw.features.map((value) => {
        const feature = isObject(value) ? value : {};
        return {
          名称: text(feature.name), 类型: text(feature.type),
          描述: text(feature.description), 引导问题: text(feature.guidingQuestion),
        };
      }) : [],
    };
  }
  if (type === "weapon" || type === "subweapon") {
    return {
      ...common,
      类型: type === "weapon" ? "主武器" : "副武器",
      属性: text(raw.trait),
      距离: text(raw.range),
      伤害: text(raw.damage),
      负荷: text(raw.burden),
      伤害类型: text(raw.damageType),
      特性名: "",
      特性描述: text(raw.feature),
      风味描述: text(raw.description),
      位阶: text(raw.tier),
    };
  }
  if (type === "armor") {
    return {
      ...common,
      类型: "护甲",
      护甲值: text(raw.score),
      重度伤害阈值: text(raw.majorThreshold),
      严重伤害阈值: text(raw.severeThreshold),
      特性名: "",
      特性描述: text(raw.feature),
      风味描述: text(raw.description),
      位阶: text(raw.tier),
    };
  }
  if (type === "loot" || type === "consumable") {
    return {
      ...common,
      类型: type === "consumable" ? "消耗品" : "物品",
      掷骰: text(raw.roll),
      描述: text(type === "consumable" ? raw.effect : raw.feature),
      风味描述: text(raw.description),
    };
  }
  if (type === "class") {
    return {
      名称: text(raw.name),
      风味描述: text(raw.description),
      领域: [text(raw.domain1), text(raw.domain2)].filter(Boolean),
      生命点: text(raw.hp),
      闪避值: text(raw.evasion),
      职业物品: text(raw.startingItems),
      希望特性: namedFeatureGroup(raw.hopeFeature),
      特性: namedFeatures(raw.features ?? raw.classFeature),
      推荐初始属性: { 敏捷: "", 力量: "", 灵巧: "", 本能: "", 风度: "", 知识: "" },
      推荐初始武器: "",
      推荐初始护甲: "",
      背景问题: [],
      关系问题: [],
    };
  }
  if (type === "ancestry") {
    return {
      名称: text(raw.name),
      原文: "",
      简介: text(raw.description),
      特性: [
        { 名称: text(raw.feature1Name), 原名: "", 描述: text(raw.feature1Desc) },
        { 名称: text(raw.feature2Name), 原名: "", 描述: text(raw.feature2Desc) },
      ].filter((feature) => feature.名称 || feature.描述),
    };
  }
  if (type === "community") {
    return {
      名称: text(raw.name),
      简介: text(raw.description),
      性格: text(raw.demeanor),
      特性: { 名称: text(raw.featureName), 描述: text(raw.featureDesc) },
    };
  }
  if (type === "domain") {
    return {
      名称: text(raw.name),
      领域: text(raw.domainName),
      等级: semanticCount(raw.level),
      属性: text(raw.category),
      回想: semanticCount(raw.recallCost),
      描述: text(raw.ability),
      风味描述: text(raw.description),
    };
  }
  return { ...raw };
}

function subclassResources(raw: JsonObject, name: string): TemporaryResource[] {
  const id = text(raw.id) || `subclass:${name}`;
  const present = subclassLevels.filter(({ field }) => text(raw[field]));
  const levels = present.length > 0 ? present : [subclassLevels[0]];
  return levels.map(({ field, level }) => ({
    sourceId: `${id}:${level}`,
    kind: "subclass",
    name: subclassName(name),
    fields: {
      名称: subclassName(name),
      主职: text(raw.baseClass),
      等级: level,
      施法属性: text(raw.spellcastingAttribute),
      描述: text(raw[field]),
      风味描述: text(raw.description),
    },
    source: { formatId: "kid", upstreamRevision, path: `/${field}`, raw },
  }));
}

function readDocument(input: Uint8Array, image: boolean): unknown {
  if (!image) return parseJson(input);
  // 上游直接把整张 PNG 宽容解码为 UTF-8，再寻找 IEND 后的分隔符。
  const decoded = new TextDecoder().decode(input);
  const marker = decoded.lastIndexOf(trailer);
  if (marker < 0) throw new Error("missing trailer");
  const payload = decoded.slice(marker + trailer.length);
  const start = payload.indexOf("{");
  const end = payload.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("missing json");
  return JSON.parse(payload.slice(start, end + 1)) as unknown;
}

function toKid(resource: TemporaryResource, options: ExportOptions): JsonObject | ConversionDiagnostic {
  const native = sourceRaw(resource, "kid");
  if (native) return { ...native, name: resource.name };
  const fields = resource.fields;
  const creator = options.creator ?? text(fields.创作者);
  const owner = options.owner ?? text(fields.所有者);
  if (!creator || !owner) return {
    code: "kid.identity.required",
    severity: "error",
    message: "导出基德格式需要 creator 与 owner。",
    resourceId: resource.sourceId,
  };
  const base = {
    id: resource.sourceId,
    name: resource.name,
    description: resource.kind === "weapon" || resource.kind === "armor" || resource.kind === "item"
      ? text(fields.风味描述)
      : text(fields.风味描述 || fields.描述 || fields.简介),
    creator,
    owner,
  };
  if (resource.kind === "weapon") return {
    ...base,
    type: text(fields.类型) === "副武器" ? "subweapon" : "weapon",
    trait: text(fields.属性),
    range: text(fields.距离),
    damage: text(fields.伤害),
    damageType: text(fields.伤害类型),
    burden: text(fields.负荷),
    feature: formatEquipmentFeature(fields),
  };
  if (resource.kind === "armor") return {
    ...base,
    type: "armor",
    score: text(fields.护甲值),
    majorThreshold: text(fields.重度伤害阈值),
    severeThreshold: text(fields.严重伤害阈值),
    feature: formatEquipmentFeature(fields),
  };
  if (resource.kind === "item") {
    const consumable = text(fields.类型) === "消耗品";
    return {
      ...base,
      type: consumable ? "consumable" : "loot",
      [consumable ? "effect" : "feature"]: text(fields.描述),
    };
  }
  if (resource.kind === "class") {
    const domains = splitJoined(fields.领域);
    return {
      ...base,
      type: "class",
      evasion: text(fields.闪避值),
      hp: text(fields.生命点),
      classFeature: formatNamedFeatures(fields.特性),
      hopeFeature: formatNamedFeatureGroup(fields.希望特性),
      domain1: domains[0] ?? "",
      domain2: domains[1] ?? "",
      startingItems: text(fields.职业物品),
    };
  }
  if (resource.kind === "ancestry") {
    const features = Array.isArray(fields.特性) ? fields.特性.map((value) => isObject(value) ? value : {}) : [];
    return {
      ...base,
      type: "ancestry",
      description: text(fields.简介),
      feature1Name: text(features[0]?.名称),
      feature1Desc: text(features[0]?.描述),
      feature2Name: text(features[1]?.名称),
      feature2Desc: text(features[1]?.描述),
    };
  }
  if (resource.kind === "community") {
    const feature = isObject(fields.特性) ? fields.特性 : {};
    return {
      ...base,
      type: "community",
      description: text(fields.简介),
      demeanor: text(fields.性格),
      featureName: text(feature.名称),
      featureDesc: text(feature.描述),
    };
  }
  if (resource.kind === "domain") return {
    ...base,
    type: "domain",
    description: text(fields.风味描述),
    domainName: text(fields.领域),
    level: semanticCount(fields.等级),
    category: text(fields.属性),
    recallCost: semanticCount(fields.回想),
    ability: text(fields.描述),
  };
  if (resource.kind === "adversary") return {
    ...base,
    type: "npc",
    difficulty: text(fields.难度),
    motive: text(fields.动机与战术),
    features: Array.isArray(fields.特性) ? fields.特性.map((value) => {
      const item = isObject(value) ? value : {};
      return {
        name: text(item.名称),
        choice: text(item.选择),
        trigger: text(item.触发),
        effect: text(item.特性描述),
      };
    }) : [],
  };
  if (resource.kind === "environment") return {
    ...base,
    type: "environment",
    tier: text(fields.位阶),
    envType: text(fields.种类),
    tendency: text(fields.趋向),
    difficulty: text(fields.难度),
    potentialEnemies: text(fields.潜在敌人),
    features: Array.isArray(fields.特性) ? fields.特性.map((value) => {
      const feature = isObject(value) ? value : {};
      return {
        name: text(feature.名称), type: text(feature.类型),
        description: text(feature.描述), guidingQuestion: text(feature.引导问题),
      };
    }) : [],
  };
  return {
    code: "kid.kind.mapping-required",
    severity: "error",
    message: `尚未裁定 ${resource.kind} 到基德 28 类结构的映射。`,
    resourceId: resource.sourceId,
  };
}

function formatEquipmentFeature(fields: JsonObject): string {
  const name = text(fields.特性名).trim();
  const description = text(fields.特性描述).trim();
  return name && description ? `${name}：${description}` : name || description;
}

function subclassToKid(resources: TemporaryResource[], options: ExportOptions): JsonObject | ConversionDiagnostic {
  const first = resources[0]!;
  const name = subclassName(first.name);
  const mainClass = text(first.fields.主职);
  if (resources.some((resource) => subclassName(resource.name) !== name || text(resource.fields.主职) !== mainClass)) {
    return {
      code: "kid.subclass.batch-mismatch",
      severity: "error",
      message: "合并为基德子职业卡的资源必须具有相同名称与主职。",
    };
  }
  const native = sourceRaw(first, "kid") ?? {};
  const creator = options.creator ?? text(native.creator || first.fields.创作者);
  const owner = options.owner ?? text(native.owner || first.fields.所有者);
  if (!creator || !owner) return {
    code: "kid.identity.required",
    severity: "error",
    message: "导出基德格式需要 creator 与 owner。",
    resourceId: first.sourceId,
  };
  const feature = (level: string) => formatNamedFeatures(resources.find((resource) => text(resource.fields.等级) === level)?.fields.特性);
  return {
    ...native,
    id: text(native.id) || first.sourceId,
    type: "subclass",
    name,
    description: text(resources.find((resource) => text(resource.fields.风味描述))?.fields.风味描述),
    creator,
    owner,
    baseClass: mainClass,
    spellcastingAttribute: text(first.fields.施法属性),
    foundationFeature: feature("基础"),
    advancedFeature: feature("进阶"),
    masteryFeature: feature("精通"),
  };
}

export const kidAdapter: ResourceFormatAdapter = {
  id: "kid",
  upstreamRevision,
  import(input) {
    const image = input.container === "png" || input.fileName.toLocaleLowerCase().endsWith(".png");
    let document: unknown;
    try {
      document = readDocument(input.bytes, image);
    } catch {
      return importFailure("kid", image ? "kid.png.data-invalid" : "kid.json.invalid", image
        ? "PNG 中没有可恢复的基德卡牌数据。"
        : "基德 JSON 无法解析。");
    }
    const raw = asJsonObject(document);
    const type = raw ? text(raw.type) : "";
    if (!raw || !cardTypes.has(type)) return importFailure("kid", "kid.card.invalid", "基德卡牌 type 无效。", "/type");
    const name = text(raw.name);
    if (!name) return importFailure("kid", "kid.card.name-missing", "基德卡牌缺少 name。", "/name");
    const resources: TemporaryResource[] = type === "subclass" ? subclassResources(raw, name) : [{
      sourceId: text(raw.id) || `${type}:${name}`,
      kind: kindFor(type),
      name,
      fields: fieldsFor(raw),
      source: { formatId: "kid", upstreamRevision, path: "/", raw },
    }];
    const diagnostics: ConversionDiagnostic[] = image ? [{
      code: "kid.png.trailing-payload-fragile",
      severity: "warning",
      message: "基德 PNG 的 JSON 位于 IEND 后，重编码会丢失。",
      resourceId: resources[0]?.sourceId,
    }] : [];
    return {
      ok: true,
      batch: {
        name,
        resources,
        sourceDocument: { formatId: "kid", upstreamRevision, container: image ? "png" : "json", raw },
        media: new Map(),
      },
      report: report("kid", "import", resources.length, diagnostics),
    };
  },
  export(batch, options: ExportOptions = {}) {
    const subclasses = batch.resources.length > 0 && batch.resources.every((resource) => resource.kind === "subclass");
    if (batch.resources.length !== 1 && !subclasses) {
      return exportFailure("kid", [{
        code: "kid.single-card.required",
        severity: "error",
        message: "基德原生 JSON 每个文件只能包含一张卡。",
      }]);
    }
    const converted = subclasses
      ? subclassToKid(batch.resources, options)
      : toKid(batch.resources[0]!, options);
    if ("severity" in converted) return exportFailure("kid", [converted as ConversionDiagnostic]);
    return {
      ok: true,
      artifact: jsonArtifact(converted, `${safeStem(batch.resources[0]!.name)}.json`),
      report: report("kid", "export", batch.resources.length),
    };
  },
};
