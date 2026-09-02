import { strToU8, unzipSync, zipSync } from "fflate";

import {
  asJsonObject,
  decoder,
  exportFailure,
  importFailure,
  jsonArtifact,
  formatNamedFeature,
  namedFeature,
  numberedTextList,
  parseJson,
  recommendedAttributes,
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
  JsonValue,
  ResourceFormatAdapter,
  ResourceKind,
  TemporaryResource,
} from "../types.ts";

const upstreamRevision = "fdc1f9e1423a5e044fc547b84f4dbe02af6a5b38";
const groups = ["profession", "ancestry", "community", "subclass", "domain", "variant"] as const;
type Group = typeof groups[number];

const equipmentValueLabels: Record<string, string> = {
  agility: "敏捷",
  strength: "力量",
  finesse: "灵巧",
  instinct: "本能",
  presence: "风度",
  knowledge: "知识",
  melee: "近战",
  veryClose: "极近距离",
  close: "近距离",
  far: "远距离",
  veryFar: "极远距离",
  oneHanded: "单手",
  twoHanded: "双手",
  physical: "物理",
  magic: "魔法",
};

function equipmentValue(value: unknown): string {
  const raw = text(value);
  return equipmentValueLabels[raw] ?? raw;
}

function equipmentTier(value: unknown): string {
  return text(value).replace(/^T(?=\d+$)/iu, "");
}

function normalizeEquipmentPack(document: JsonObject): JsonObject | null {
  if (text(document.format) !== "daggerheart.equipment-pack.v1") return null;
  const equipment = asJsonObject(document.equipment);
  if (!equipment) return null;
  const weapons = Array.isArray(equipment.weapons) ? equipment.weapons : [];
  const armor = Array.isArray(equipment.armor) ? equipment.armor : [];
  const variant: JsonObject[] = [];
  weapons.forEach((value) => {
    const raw = asJsonObject(value);
    if (!raw) return;
    variant.push({
      id: text(raw.id),
      名称: text(raw.name),
      类型: text(raw.weaponType) === "secondary" ? "副武器" : "主武器",
      属性: equipmentValue(raw.trait),
      距离: equipmentValue(raw.range),
      伤害: text(raw.damage),
      负荷: equipmentValue(raw.burden),
      伤害类型: equipmentValue(raw.damageType),
      特性名: text(raw.featureName),
      特性原名: "",
      特性描述: text(raw.description),
      位阶: equipmentTier(raw.tier),
    });
  });
  armor.forEach((value) => {
    const raw = asJsonObject(value);
    if (!raw) return;
    const thresholds = asJsonObject(raw.baseThresholds) ?? {};
    variant.push({
      id: text(raw.id),
      名称: text(raw.name),
      类型: "护甲",
      护甲值: text(raw.baseArmorMax),
      重度伤害阈值: text(thresholds.minor),
      严重伤害阈值: text(thresholds.major),
      特性名: text(raw.featureName),
      特性原名: "",
      特性描述: text(raw.description),
      位阶: equipmentTier(raw.tier),
    });
  });
  return { ...document, variant };
}

function subclassName(value: unknown): string {
  return text(value).replace(/[\s\-－—]*(?:基础|进阶|精通|基石|专精|大师)$/u, "").trim();
}

function canonicalSubclassLevel(value: unknown): string {
  const level = text(value);
  return ({ 基石: "基础", 专精: "进阶", 大师: "精通" } as Record<string, string>)[level] ?? level;
}

function dhsheetSubclassLevel(value: unknown): string {
  return ({ 基础: "基石", 进阶: "专精", 精通: "大师" } as Record<string, string>)[text(value)] ?? text(value);
}

function kindFor(group: Group, raw: JsonObject): ResourceKind {
  if (group === "profession") return "class";
  if (group === "ancestry") return "ancestry";
  if (group === "community") return "community";
  if (group === "subclass") return "subclass";
  if (group === "domain") return "domain";
  const type = text(raw.类型);
  if (["主武器", "副武器", "武器"].includes(type)) return "weapon";
  if (type === "护甲") return "armor";
  if (["物品", "消耗品", "战利品"].includes(type)) return "item";
  if (type === "敌人") return "adversary";
  if (type === "环境") return "environment";
  return "free";
}

function freeFieldBody(value: JsonValue): string {
  if (typeof value === "string") return value;
  if (value === null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function freeVariantFields(raw: JsonObject): JsonObject {
  const omitted = new Set(["id", "名称", "类型", "内容", "imageUrl"]);
  const looseBlocks = Object.entries(raw)
    .filter(([key, value]) => !omitted.has(key)
      && !(key === "类型" && Array.isArray(raw.内容) && text(value) === "自由"))
    .map(([key, value]) => ({ 标题: key, 正文: freeFieldBody(value) }))
    .filter((block) => block.正文.trim().length > 0);
  if (Array.isArray(raw.内容)) {
    return {
      名称: text(raw.名称),
      类型: text(raw.类型 || "自由"),
      内容: [...looseBlocks, ...raw.内容.map((value) => {
        const block = asJsonObject(value) ?? {};
        return { 标题: text(block.标题), 正文: freeFieldBody(block.正文) };
      })],
    };
  }
  return {
    名称: text(raw.名称),
    类型: text(raw.类型 || "自由"),
    内容: looseBlocks,
  };
}

function fieldsFor(group: Group, raw: JsonObject): JsonObject {
  if (group === "profession") return {
    名称: text(raw.名称),
    类型: text(raw.类型 || "职业"),
    描述: text(raw.描述 || raw.简介),
    领域: splitJoined(raw.领域).length > 0
      ? splitJoined(raw.领域)
      : [text(raw.领域1), text(raw.领域2)].filter(Boolean),
    生命点: text(raw.生命点 || raw.起始生命 || raw.初始生命点),
    闪避值: text(raw.闪避值 || raw.起始闪避 || raw.初始闪避值),
    职业物品: text(raw.职业物品 || raw.起始物品),
    希望特性: text(raw.希望特性),
    职业特性: text(raw.职业特性),
    推荐初始属性: recommendedAttributes(raw.推荐初始属性),
    推荐初始武器: splitJoined(raw.推荐初始武器),
    推荐初始护甲: text(raw.推荐初始护甲),
    背景问题: numberedTextList(raw, "背景问题", "背景问题"),
    关系问题: numberedTextList(raw, "关系问题", "关系问题"),
    施法属性: text(raw.施法属性 || raw.施法),
  };
  if (group === "ancestry") return {
    名称: text(raw.种族),
    原文: "",
    类型: "种族",
    简介: text(raw.简介),
    特性: [{ 名称: text(raw.名称), 原名: "", 描述: text(raw.效果) }],
  };
  if (group === "community") return {
    名称: text(raw.名称),
    类型: "社群",
    简介: text(raw.简介),
    性格: text(raw.特性),
    特性: namedFeature(raw.描述),
  };
  if (group === "subclass") return {
    名称: subclassName(raw.子职业 || raw.名称),
    类型: "子职业",
    主职: text(raw.主职),
    等级: canonicalSubclassLevel(raw.等级),
    施法属性: text(raw.施法属性 || raw.施法),
    描述: text(raw.描述),
    风味描述: text(raw.风味描述),
  };
  if (group === "domain") return {
    名称: text(raw.名称),
    类型: "领域卡",
    领域: text(raw.领域),
    等级: semanticCount(raw.等级),
    属性: text(raw.属性),
    回想: semanticCount(raw.回想),
    描述: text(raw.描述),
    风味描述: text(raw.风味描述),
  };
  if (["主武器", "副武器", "武器"].includes(text(raw.类型))) return {
    名称: text(raw.名称),
    原文: text(raw.原文),
    类型: text(raw.类型),
    属性: text(raw.属性),
    距离: text(raw.距离),
    伤害: text(raw.伤害),
    负荷: text(raw.负荷),
    伤害类型: text(raw.伤害类型),
    特性名: text(raw.特性名),
    特性原名: text(raw.特性原名),
    特性描述: text(raw.特性描述 || raw.描述 || raw.效果),
    风味描述: text(raw.风味描述),
    位阶: text(raw.位阶),
  };
  if (text(raw.类型) === "护甲") return {
    名称: text(raw.名称),
    原文: text(raw.原文),
    类型: "护甲",
    护甲值: text(raw.护甲值),
    重度伤害阈值: text(raw.重度伤害阈值 || raw.重度阈值 || raw.重伤阈值),
    严重伤害阈值: text(raw.严重伤害阈值 || raw.严重阈值),
    特性名: text(raw.特性名),
    特性原名: text(raw.特性原名),
    特性描述: text(raw.特性描述 || raw.描述 || raw.效果),
    风味描述: text(raw.风味描述),
    位阶: text(raw.位阶),
  };
  if (["物品", "消耗品", "战利品"].includes(text(raw.类型))) return {
    名称: text(raw.名称),
    类型: text(raw.类型) === "消耗品" ? "消耗品" : "物品",
    掷骰: text(raw.掷骰),
    描述: text(raw.描述 || raw.效果),
    风味描述: text(raw.风味描述),
  };
  if (group === "variant" && kindFor(group, raw) === "free") return freeVariantFields(raw);
  return { ...raw };
}

function readInput(bytes: Uint8Array, dhcb: boolean): { document: unknown; media: Map<string, Uint8Array> } {
  if (!dhcb) return { document: parseJson(bytes), media: new Map() };
  const files = unzipSync(bytes);
  const cards = files["cards.json"];
  if (!cards) throw new Error("cards missing");
  const media = new Map<string, Uint8Array>();
  Object.entries(files).filter(([path]) => path.startsWith("images/")).forEach(([path, value]) => media.set(path, value));
  return { document: JSON.parse(decoder.decode(cards)) as unknown, media };
}

function groupFor(resource: TemporaryResource): Group | undefined {
  if (resource.source.formatId === "dhsheet") {
    return groups.find((group) => resource.source.path.startsWith(`/${group}/`));
  }
  if (resource.kind === "class") return "profession";
  if (resource.kind === "ancestry") return "ancestry";
  if (resource.kind === "community") return "community";
  if (resource.kind === "subclass") return "subclass";
  if (resource.kind === "domain") return "domain";
  if (["adversary", "environment", "weapon", "armor", "item", "free"].includes(resource.kind)) return "variant";
  return undefined;
}

function crossFormatRecord(resource: TemporaryResource, group: Group): JsonObject {
  const fields = resource.fields;
  const id = resource.sourceId;
  if (group === "profession") return {
    ...fields,
    id, 名称: resource.name, 简介: text(fields.描述), 描述: text(fields.描述),
    领域1: splitJoined(fields.领域)[0] ?? "", 领域2: splitJoined(fields.领域)[1] ?? "",
    起始生命: Number(text(fields.生命点)) || 0, 起始闪避: Number(text(fields.闪避值)) || 0,
    起始物品: text(fields.职业物品), 希望特性: text(fields.希望特性), 职业特性: text(fields.职业特性),
  };
  if (group === "community") return {
    id, 名称: resource.name, 特性: text(fields.性格), 简介: text(fields.简介), 描述: formatNamedFeature(fields.特性),
  };
  if (group === "subclass") return {
    id, 名称: resource.name, 子职业: resource.name, 主职: text(fields.主职),
    等级: dhsheetSubclassLevel(fields.等级), 施法: text(fields.施法属性),
    描述: text(fields.描述), 风味描述: text(fields.风味描述),
  };
  if (group === "domain") return {
    id, 名称: resource.name, 领域: text(fields.领域), 等级: Number(text(fields.等级)) || 0,
    属性: text(fields.属性), 回想: Number(text(fields.回想)) || 0, 描述: text(fields.描述),
  };
  if (resource.kind === "armor") return {
    id,
    名称: resource.name,
    类型: "护甲",
    特性名: text(fields.特性名),
    特性原名: text(fields.特性原名),
    特性描述: text(fields.特性描述),
    护甲值: text(fields.护甲值),
    重度阈值: text(fields.重度伤害阈值),
    严重阈值: text(fields.严重伤害阈值),
    风味描述: text(fields.风味描述),
    位阶: text(fields.位阶),
  };
  if (resource.kind === "free") return {
    id,
    名称: resource.name,
    类型: text(fields.类型 || "自由"),
    内容: Array.isArray(fields.内容) ? fields.内容 : [],
  };
  return {
    id,
    名称: resource.name,
    类型: resource.kind === "weapon" ? text(fields.类型 || "武器")
      : resource.kind === "adversary" ? "敌人"
        : resource.kind === "environment" ? "环境"
          : text(fields.类型 || resource.kind),
    效果: text(fields.描述 || fields.简介),
    ...fields,
  };
}

function ancestryRecords(resource: TemporaryResource): JsonObject[] {
  const native = sourceRaw(resource, "dhsheet");
  if (native && Array.isArray(native.records)) {
    return native.records.map(asJsonObject).filter((record): record is JsonObject => Boolean(record));
  }
  const features = Array.isArray(resource.fields.特性) ? resource.fields.特性 : [];
  const records = features.map((value, index) => {
    const feature = asJsonObject(value) ?? {};
    return {
      id: `${resource.sourceId}:${index + 1}`,
      名称: text(feature.名称),
      种族: resource.name,
      简介: text(resource.fields.简介),
      效果: text(feature.描述),
      类别: index + 1,
    };
  });
  return records.length > 0 ? records : [{
    id: `${resource.sourceId}:1`, 名称: "", 种族: resource.name,
    简介: text(resource.fields.简介), 效果: "", 类别: 1,
  }];
}

export const dhsheetAdapter: ResourceFormatAdapter = {
  id: "dhsheet",
  upstreamRevision,
  import(input) {
    const dhcb = input.container === "dhcb" || input.fileName.toLocaleLowerCase().endsWith(".dhcb");
    let read: { document: unknown; media: Map<string, Uint8Array> };
    try {
      read = readInput(input.bytes, dhcb);
    } catch {
      return importFailure("dhsheet", dhcb ? "dhsheet.dhcb.invalid" : "dhsheet.json.invalid", dhcb
        ? "dhsheet .dhcb 缺少有效 cards.json。"
        : "dhsheet JSON 无法解析。");
    }
    const document = asJsonObject(read.document);
    const normalizedDocument = document ? normalizeEquipmentPack(document) ?? document : null;
    if (!normalizedDocument || !groups.some((group) => Array.isArray(normalizedDocument[group]))) {
      return importFailure("dhsheet", "dhsheet.pack.invalid", "dhsheet 卡包没有六类分组数组。");
    }
    const resources: TemporaryResource[] = [];
    const diagnostics: ConversionDiagnostic[] = [];
    for (const group of groups) {
      const records = normalizedDocument[group];
      if (!Array.isArray(records)) continue;
      if (group === "ancestry") {
        const ancestryGroups = new Map<string, Array<{ raw: JsonObject; index: number }>>();
        records.forEach((value, index) => {
          const raw = asJsonObject(value);
          const name = raw ? text(raw.种族) : "";
          if (!raw || !name) {
            diagnostics.push({
              code: "dhsheet.record.invalid", severity: "error", message: "ancestry 记录无效。", path: `/ancestry/${index}`,
            });
            return;
          }
          const key = `${name}\u0000${text(raw.简介)}`;
          const entries = ancestryGroups.get(key) ?? [];
          entries.push({ raw, index });
          ancestryGroups.set(key, entries);
        });
        for (const entries of ancestryGroups.values()) {
          entries.sort((left, right) => Number(text(left.raw.类别)) - Number(text(right.raw.类别)));
          const first = entries[0]!;
          const name = text(first.raw.种族);
          resources.push({
            sourceId: text(first.raw.id) || `ancestry:${first.index}`,
            kind: "ancestry",
            name,
            fields: {
              名称: name,
              原文: "",
              简介: text(first.raw.简介),
              特性: entries.map(({ raw }) => ({ 名称: text(raw.名称), 原名: "", 描述: text(raw.效果) })),
            },
            source: {
              formatId: "dhsheet", upstreamRevision, path: `/ancestry/${first.index}`,
              raw: { records: entries.map(({ raw }) => raw) },
            },
          });
        }
        continue;
      }
      records.forEach((value, index) => {
        const raw = asJsonObject(value);
        if (!raw || !text(raw.名称 || raw.种族 || raw.子职业)) {
          diagnostics.push({
            code: "dhsheet.record.invalid", severity: "error", message: `${group} 记录无效。`, path: `/${group}/${index}`,
          });
          return;
        }
        const name = text(raw.种族 || raw.子职业 || raw.名称);
        resources.push({
          sourceId: text(raw.id) || `${group}:${index}`,
          kind: kindFor(group, raw),
          name,
          fields: fieldsFor(group, raw),
          source: { formatId: "dhsheet", upstreamRevision, path: `/${group}/${index}`, raw },
        });
      });
    }
    if (resources.length === 0) return { ok: false, report: report("dhsheet", "import", 0, diagnostics) };
    return {
      ok: true,
      batch: {
        name: text(normalizedDocument.name) || input.fileName.replace(/\.(?:json|dhcb)$/iu, ""),
        version: text(normalizedDocument.version) || undefined,
        resources,
        sourceDocument: { formatId: "dhsheet", upstreamRevision, container: dhcb ? "dhcb" : "json", raw: document },
        media: read.media,
      },
      report: report("dhsheet", "import", resources.length, diagnostics),
    };
  },
  export(batch, options: ExportOptions = {}) {
    const output: JsonObject = {
      name: options.packageName ?? batch.name,
      version: options.packageVersion ?? batch.version ?? "1.0.0",
      description: "",
      author: options.creator ?? "",
      customFieldDefinitions: { variants: [] },
      profession: [], ancestry: [], community: [], subclass: [], domain: [], variant: [],
    };
    const diagnostics: ConversionDiagnostic[] = [];
    let converted = 0;
    for (const resource of batch.resources) {
      const group = groupFor(resource);
      if (!group) {
        const decision: ConversionDiagnostic = {
          code: "dhsheet.kind.unrepresentable",
          severity: "warning",
          message: `dhsheet 没有 ${resource.kind} 原生分组。`,
          resourceId: resource.sourceId,
        };
        if (!options.allowDecision?.(decision, resource)) {
          diagnostics.push({ ...decision, severity: "error", code: "conversion.decision-required" });
          continue;
        }
        diagnostics.push(decision);
        (output.variant as JsonValue[]).push(crossFormatRecord(resource, "variant"));
        converted += 1;
        continue;
      }
      if (group === "variant") {
        const definitions = output.customFieldDefinitions as JsonObject;
        const variants = definitions.variants as JsonValue[];
        const type = resource.kind === "free" ? text(resource.fields.类型 || "自由")
          : resource.kind === "adversary" ? "敌人"
          : resource.kind === "environment" ? "环境"
            : text(resource.fields.类型 || resource.kind);
        if (!variants.includes(type)) variants.push(type);
      }
      if (group === "ancestry") (output.ancestry as JsonValue[]).push(...ancestryRecords(resource));
      else (output[group] as JsonValue[]).push(sourceRaw(resource, "dhsheet") ?? crossFormatRecord(resource, group));
      converted += 1;
    }
    if (diagnostics.some((item) => item.severity === "error")) return exportFailure("dhsheet", diagnostics, converted);
    const container = options.container ?? "json";
    if (container === "json") return {
      ok: true,
      artifact: jsonArtifact(output, `${safeStem(text(output.name))}.json`),
      report: report("dhsheet", "export", converted, diagnostics),
    };
    if (container !== "dhcb") return exportFailure("dhsheet", [{
      code: "dhsheet.container.unsupported", severity: "error", message: `dhsheet 不支持 ${container} 容器。`,
    }], converted);
    const files: Record<string, Uint8Array> = {
      "manifest.json": strToU8(JSON.stringify({
        format: "DaggerHeart Card Batch", version: "1.0", createdAt: "2000-01-01T00:00:00.000Z", hasImages: batch.media.size > 0,
      }, null, 2)),
      "cards.json": strToU8(JSON.stringify(output, null, 2)),
    };
    for (const [path, bytes] of batch.media) if (path.startsWith("images/")) files[path] = bytes;
    return {
      ok: true,
      artifact: {
        bytes: zipSync(files, { level: 6 }), fileName: `${safeStem(text(output.name))}.dhcb`, container: "dhcb", mediaType: "application/zip",
      },
      report: report("dhsheet", "export", converted, diagnostics),
    };
  },
};
