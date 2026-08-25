import {
  asJsonObject,
  exportFailure,
  formatNamedFeature,
  importFailure,
  jsonArtifact,
  numberedTextList,
  namedFeature,
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
  JsonObject,
  JsonValue,
  ResourceFormatAdapter,
  ResourceKind,
  TemporaryResource,
} from "../types.ts";

const upstreamRevision = "64e6a4484dd1daf9b93779dcf7aaea6e512efde4";

function subclassName(value: unknown): string {
  return text(value).replace(/[\s\-－—]*(?:基础|进阶|精通)$/u, "").trim();
}

function ancestryFeatures(value: unknown): JsonValue[] {
  const description = text(value).trim();
  if (!description) return [];
  const lines = description.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 2) {
    const parsed = lines.map((line) => /^(.+?)[：:]\s*(.+)$/u.exec(line));
    if (parsed.every(Boolean)) return parsed.map((match) => ({ 名称: match![1]!.trim(), 描述: match![2]!.trim() }));
  }
  return [{ 名称: "", 描述: description }];
}

function ancestryDescription(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.map((item) => {
    const feature = asJsonObject(item) ?? {};
    const name = text(feature.名称).trim();
    const description = text(feature.描述).trim();
    return name ? `${name}：${description}` : description;
  }).filter(Boolean).join("\n");
}

function kindFor(type: string): ResourceKind {
  if (["主武器", "副武器", "武器"].includes(type)) return "weapon";
  if (type === "护甲") return "armor";
  if (["物品", "消耗品", "战利品"].includes(type)) return "item";
  if (type === "主职") return "class";
  if (type === "子职") return "subclass";
  if (type === "种族") return "ancestry";
  if (type === "社群") return "community";
  if (type === "领域卡") return "domain";
  if (type === "敌人") return "adversary";
  if (type === "环境") return "environment";
  return "free";
}

function normalizedFields(raw: JsonObject): JsonObject {
  const type = text(raw.类型);
  if (kindFor(type) === "weapon") return {
    名称: text(raw.名称), 类型: type, 属性: text(raw.属性), 距离: text(raw.距离), 伤害: text(raw.伤害),
    负荷: text(raw.双手) === "true" || raw.双手 === true ? "双手" : text(raw.负荷 || "单手"),
    伤害类型: text(raw.伤害类型), 描述: text(raw.描述), 风味描述: text(raw.风味描述), 位阶: text(raw.位阶),
  };
  if (kindFor(type) === "armor") return {
    名称: text(raw.名称),
    类型: "护甲",
    护甲值: text(raw.护甲值),
    重度伤害阈值: text(raw.重度伤害阈值 || raw.重伤阈值 || raw.重度阈值),
    严重伤害阈值: text(raw.严重伤害阈值 || raw.严重阈值),
    描述: text(raw.描述),
    风味描述: text(raw.风味描述),
    位阶: text(raw.位阶),
  };
  if (kindFor(type) === "item") return {
    名称: text(raw.名称),
    类型: type === "消耗品" ? "消耗品" : "物品",
    掷骰: text(raw.掷骰),
    描述: text(raw.描述 || raw.效果),
    风味描述: text(raw.风味描述),
  };
  if (kindFor(type) === "class") return {
    名称: text(raw.名称),
    描述: text(raw.描述),
    领域: splitJoined(raw.领域),
    生命点: text(raw.生命点 || raw.初始生命点 || raw.起始生命),
    闪避值: text(raw.闪避值 || raw.初始闪避值 || raw.起始闪避),
    职业物品: text(raw.职业物品 || raw.起始物品),
    希望特性: text(raw.希望特性),
    职业特性: text(raw.职业特性),
    推荐初始属性: recommendedAttributes(raw.推荐初始属性),
    推荐初始武器: text(raw.推荐初始武器),
    推荐初始护甲: text(raw.推荐初始护甲),
    背景问题: numberedTextList(raw, "背景问题", "背景问题"),
    关系问题: numberedTextList(raw, "关系问题", "关系问题"),
    施法属性: text(raw.施法属性),
  };
  if (kindFor(type) === "subclass") return {
    名称: subclassName(raw.名称),
    主职: text(raw.主职),
    等级: text(raw.等级),
    施法属性: text(raw.施法属性),
    描述: text(raw.描述),
    风味描述: text(raw.风味描述),
  };
  if (kindFor(type) === "ancestry") return {
    名称: text(raw.名称),
    简介: text(raw.简介),
    特性: ancestryFeatures(raw.描述),
  };
  if (kindFor(type) === "community") return {
    名称: text(raw.名称),
    简介: text(raw.简介),
    性格: text(raw.性格 || raw.特性),
    特性: namedFeature(raw.描述),
  };
  if (kindFor(type) === "domain") return {
    名称: text(raw.名称),
    领域: text(raw.领域),
    等级: semanticCount(raw.等级),
    属性: text(raw.属性),
    回想: semanticCount(raw.回想),
    描述: text(raw.描述),
    风味描述: text(raw.风味描述),
  };
  return { ...raw };
}

function crossFormat(resource: TemporaryResource): JsonObject | undefined {
  const fields = resource.fields;
  if (resource.kind === "adversary") return { ...fields, 名称: resource.name, 类型: "敌人" };
  if (resource.kind === "environment") return { ...fields, 名称: resource.name, 类型: "环境" };
  if (resource.kind === "weapon") return {
    名称: resource.name, 类型: text(fields.类型 || "主武器"), 属性: text(fields.属性), 距离: text(fields.距离),
    伤害: text(fields.伤害), 双手: text(fields.负荷) === "双手", 伤害类型: text(fields.伤害类型),
    描述: text(fields.描述), 风味描述: text(fields.风味描述), 位阶: text(fields.位阶),
  };
  if (resource.kind === "armor") return {
    名称: resource.name,
    类型: "护甲",
    护甲值: text(fields.护甲值),
    重伤阈值: text(fields.重度伤害阈值),
    严重阈值: text(fields.严重伤害阈值),
    描述: text(fields.描述),
    风味描述: text(fields.风味描述),
    位阶: text(fields.位阶),
  };
  if (resource.kind === "class") return {
    名称: resource.name,
    类型: "主职",
    描述: text(fields.描述),
    领域: splitJoined(fields.领域).join("+"),
    初始生命点: text(fields.生命点),
    初始闪避值: text(fields.闪避值),
    职业物品: text(fields.职业物品),
    希望特性: text(fields.希望特性),
    职业特性: text(fields.职业特性),
    推荐初始属性: asJsonObject(fields.推荐初始属性) ?? {},
    推荐初始武器: text(fields.推荐初始武器),
    推荐初始护甲: text(fields.推荐初始护甲),
    背景问题: Array.isArray(fields.背景问题) ? fields.背景问题 : [],
    关系问题: Array.isArray(fields.关系问题) ? fields.关系问题 : [],
    施法属性: text(fields.施法属性),
  };
  if (resource.kind === "subclass") return {
    名称: `${resource.name}-${text(fields.等级)}`,
    类型: "子职",
    主职: text(fields.主职),
    等级: text(fields.等级),
    施法属性: text(fields.施法属性),
    描述: text(fields.描述),
    风味描述: text(fields.风味描述),
  };
  if (resource.kind === "ancestry") return {
    名称: resource.name,
    类型: "种族",
    简介: text(fields.简介),
    描述: ancestryDescription(fields.特性),
  };
  if (resource.kind === "community") return {
    名称: resource.name,
    类型: "社群",
    简介: text(fields.简介),
    性格: text(fields.性格),
    描述: formatNamedFeature(fields.特性),
  };
  if (resource.kind === "domain") return {
    名称: resource.name,
    类型: "领域卡",
    领域: text(fields.领域),
    等级: Number(semanticCount(fields.等级)) || 0,
    属性: text(fields.属性),
    回想: Number(semanticCount(fields.回想)) || 0,
    描述: text(fields.描述),
  };
  if (["ancestry", "community", "domain", "item", "free"].includes(resource.kind)) {
    return { 名称: resource.name, ...fields };
  }
  return undefined;
}

export const zzzAdapter: ResourceFormatAdapter = {
  id: "zzz",
  upstreamRevision,
  import(input) {
    let document: unknown;
    try {
      document = parseJson(input.bytes);
    } catch {
      return importFailure("zzz", "zzz.json.invalid", "ZZZ JSON 无法解析。");
    }
    if (!Array.isArray(document)) return importFailure("zzz", "zzz.card-array.required", "ZZZ 资源卡包必须是数组。");
    const resources: TemporaryResource[] = [];
    const diagnostics: ConversionDiagnostic[] = [];
    document.forEach((value, index) => {
      if (typeof value === "string") {
        resources.push({
          sourceId: `string:${index}`,
          kind: "opaque",
          name: value,
          fields: { value },
          source: { formatId: "zzz", upstreamRevision, path: `/${index}`, raw: value },
        });
        diagnostics.push({
          code: "zzz.record.non-object",
          severity: "warning",
          message: "ZZZ 页面会忽略字符串卡牌项；转换信封仍保留原值。",
          path: `/${index}`,
          resourceId: `string:${index}`,
        });
        return;
      }
      const raw = asJsonObject(value);
      if (!raw || !text(raw.名称)) {
        diagnostics.push({ code: "zzz.record.invalid", severity: "error", message: "ZZZ 卡牌缺少名称。", path: `/${index}` });
        return;
      }
      const type = text(raw.类型);
      const kind = kindFor(type);
      const name = kind === "subclass" ? subclassName(raw.名称) : text(raw.名称);
      resources.push({
        sourceId: text(raw.原名) || `${type || "card"}:${index}`,
        kind,
        name,
        fields: normalizedFields(raw),
        source: { formatId: "zzz", upstreamRevision, path: `/${index}`, raw },
      });
    });
    if (resources.length === 0) return { ok: false, report: report("zzz", "import", 0, diagnostics) };
    return {
      ok: true,
      batch: {
        name: input.fileName.replace(/\.json$/iu, ""),
        resources,
        sourceDocument: { formatId: "zzz", upstreamRevision, container: "json", raw: document as JsonValue },
        media: new Map(),
      },
      report: report("zzz", "import", resources.length, diagnostics),
    };
  },
  export(batch) {
    const values: JsonValue[] = [];
    const diagnostics: ConversionDiagnostic[] = [];
    for (const resource of batch.resources) {
      if (resource.source.formatId === "zzz") {
        const native = sourceRaw(resource, "zzz");
        values.push(native ?? resource.source.raw);
        continue;
      }
      const value = crossFormat(resource);
      if (!value) {
        diagnostics.push({
          code: "conversion.decision-required",
          severity: "error",
          message: `尚未裁定 ${resource.kind} 到 ZZZ 的降级格式。`,
          resourceId: resource.sourceId,
        });
        continue;
      }
      values.push(value);
    }
    if (diagnostics.some((item) => item.severity === "error")) return exportFailure("zzz", diagnostics, values.length);
    return {
      ok: true,
      artifact: jsonArtifact(values, `${safeStem(batch.name)}_zzz.json`),
      report: report("zzz", "export", values.length, diagnostics),
    };
  },
};
