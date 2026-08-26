import {
  asJsonObject,
  exportFailure,
  importFailure,
  isObject,
  jsonArtifact,
  parseJson,
  report,
  safeStem,
  sourceRaw,
  text,
} from "../shared.ts";
import type {
  ConversionDiagnostic,
  ExportOptions,
  JsonObject,
  JsonValue,
  ResourceFormatAdapter,
  TemporaryResource,
} from "../types.ts";

const upstreamRevision = "bbf7faa1303c2bbeacfbe8ff339c7ba4cec6e10a";

function feature(value: unknown): JsonObject {
  const item = isObject(value) ? value : {};
  return {
    名称: text(item.name),
    原名: "",
    类型: text(item.type || "被动"),
    特性描述: text(item.desc || item.effect),
    ...(item.flavor !== undefined ? { 风味: text(item.flavor) } : {}),
    ...(item.trigger !== undefined ? { 触发: text(item.trigger) } : {}),
    ...(item.choice !== undefined ? { 选择: text(item.choice) } : {}),
  };
}

function enemyFields(raw: JsonObject): JsonObject {
  const threshold = text(raw.threshold).split("/");
  const traits = Array.isArray(raw.traits) ? raw.traits.map(feature) : [];
  const specialTraits = Array.isArray(raw.specialTraits) ? raw.specialTraits.map(feature) : [];
  return {
    名称: text(raw.name),
    原文: "",
    位阶: text(raw.rank),
    种类: text(raw.type),
    特性: [...traits, ...specialTraits],
    类型: "敌人",
    简介: text(raw.description),
    动机与战术: text(raw.motivation),
    难度: text(raw.difficulty),
    重度伤害阈值: threshold[0] ?? "",
    严重伤害阈值: threshold[1] ?? "",
    生命点: text(raw.health),
    压力点: text(raw.stress),
    攻击命中: text(raw.attackBonus),
    攻击武器: text(raw.weaponName),
    攻击范围: text(raw.weaponRange),
    攻击伤害: text(raw.damageDice),
    攻击属性: text(raw.damageType),
    经历: Array.isArray(raw.experiences) ? raw.experiences.map(text).join("；") : "",
  };
}

function sceneFields(raw: JsonObject): JsonObject {
  return {
    名称: text(raw.name),
    原文: text(raw.nameEn),
    位阶: text(raw.rank),
    种类: text(raw.type),
    类型: "环境",
    简介: text(raw.description),
    趋向: text(raw.tendencies),
    难度: text(raw.difficulty),
    潜在敌人: text(raw.enemies),
    特性: Array.isArray(raw.traits) ? raw.traits.map((value) => {
      const item = isObject(value) ? value : {};
      return {
        名称: text(item.name),
        类型: text(item.type),
        描述: text(item.desc),
        引导问题: text(item.qs),
      };
    }) : [],
  };
}

function parseRecord(value: unknown, index: number): TemporaryResource | ConversionDiagnostic {
  const raw = asJsonObject(value);
  if (!raw) return {
    code: "rinkcx.record.invalid",
    severity: "error",
    message: "RinkCX 卡牌必须是 JSON 对象。",
    path: `/${index}`,
  };
  const enemy = Object.hasOwn(raw, "health") || Object.hasOwn(raw, "threshold");
  const name = text(raw.name);
  if (!name) return {
    code: "rinkcx.record.name-missing",
    severity: "error",
    message: "RinkCX 卡牌缺少 name。",
    path: `/${index}/name`,
  };
  return {
    sourceId: `${enemy ? "enemy" : "scene"}:${index}`,
    kind: enemy ? "adversary" : "environment",
    name,
    fields: enemy ? enemyFields(raw) : sceneFields(raw),
    source: { formatId: "rinkcx", upstreamRevision, path: `/${index}`, raw },
  };
}

function featureToRink(value: JsonValue, special: boolean): JsonObject {
  const item = isObject(value) ? value : {};
  if (special) {
    return {
      name: text(item.名称),
      trigger: text(item.触发),
      choice: text(item.选择),
      effect: text(item.特性描述),
    };
  }
  return { name: text(item.名称), desc: text(item.特性描述), flavor: text(item.风味) };
}

function exportEnemy(resource: TemporaryResource): JsonObject {
  const raw = sourceRaw(resource, "rinkcx") ?? {};
  const fields = resource.fields;
  const features = Array.isArray(fields.特性) ? fields.特性 : [];
  const normal = features.filter((value) => !isObject(value) || (!value.触发 && !value.选择));
  const special = features.filter((value) => isObject(value) && (value.触发 || value.选择));
  return {
    ...raw,
    name: resource.name,
    rank: text(fields.位阶),
    type: text(fields.种类),
    description: text(fields.简介),
    motivation: text(fields.动机与战术),
    difficulty: text(fields.难度),
    threshold: [text(fields.重度伤害阈值), text(fields.严重伤害阈值)].join("/"),
    health: text(fields.生命点),
    stress: text(fields.压力点),
    attackBonus: text(fields.攻击命中),
    weaponName: text(fields.攻击武器),
    weaponRange: text(fields.攻击范围),
    damageDice: text(fields.攻击伤害),
    damageType: text(fields.攻击属性),
    experiences: text(fields.经历).split(/[；\n]/u).filter(Boolean),
    traits: normal.map((value) => featureToRink(value, false)),
    specialTraits: special.map((value) => featureToRink(value, true)),
    isNPC: true,
  };
}

function exportScene(resource: TemporaryResource): JsonObject {
  const raw = sourceRaw(resource, "rinkcx") ?? {};
  const fields = resource.fields;
  return {
    ...raw,
    name: resource.name,
    nameEn: text(fields.原文),
    rank: text(fields.位阶),
    type: text(fields.种类),
    description: text(fields.简介),
    tendencies: text(fields.趋向),
    difficulty: text(fields.难度),
    enemies: text(fields.潜在敌人),
    traits: Array.isArray(fields.特性) ? fields.特性.map((value) => {
      const item = isObject(value) ? value : {};
      return {
        name: text(item.名称),
        type: text(item.类型),
        desc: text(item.描述),
        qs: text(item.引导问题),
      };
    }) : [],
  };
}

export const rinkcxAdapter: ResourceFormatAdapter = {
  id: "rinkcx",
  upstreamRevision,
  import(input) {
    let document: unknown;
    try {
      document = parseJson(input.bytes);
    } catch {
      return importFailure("rinkcx", "rinkcx.json.invalid", "RinkCX JSON 无法解析。");
    }
    const values = Array.isArray(document) ? document : [document];
    const resources: TemporaryResource[] = [];
    const diagnostics: ConversionDiagnostic[] = [];
    values.forEach((value, index) => {
      const parsed = parseRecord(value, index);
      if ("severity" in parsed) diagnostics.push(parsed);
      else resources.push(parsed);
    });
    if (resources.length === 0) return { ok: false, report: report("rinkcx", "import", 0, diagnostics) };
    return {
      ok: true,
      batch: {
        name: input.fileName.replace(/\.json$/iu, ""),
        resources,
        sourceDocument: { formatId: "rinkcx", upstreamRevision, container: "json", raw: document as JsonValue },
        media: new Map(),
      },
      report: report("rinkcx", "import", resources.length, diagnostics),
    };
  },
  export(batch, options: ExportOptions = {}) {
    const output: JsonObject[] = [];
    const diagnostics: ConversionDiagnostic[] = [];
    for (const resource of batch.resources) {
      if (resource.kind !== "adversary" && resource.kind !== "environment") {
        diagnostics.push({
          code: "rinkcx.kind.unsupported",
          severity: "error",
          message: `RinkCX 不能表达 ${resource.kind} 资源。`,
          resourceId: resource.sourceId,
        });
        continue;
      }
      output.push(resource.kind === "adversary" ? exportEnemy(resource) : exportScene(resource));
    }
    if (diagnostics.some((item) => item.severity === "error")) return exportFailure("rinkcx", diagnostics, output.length);
    const value: JsonValue = output.length === 1 ? output[0]! : output;
    return {
      ok: true,
      artifact: jsonArtifact(value, `${safeStem(options.packageName ?? batch.name)}.json`),
      report: report("rinkcx", "export", output.length, diagnostics),
    };
  },
};
