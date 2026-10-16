import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";

import { exportFailure, jsonArtifact, report, safeStem, text } from "../shared.ts";
import type { ConversionDiagnostic, ExportOptions, ExportResult, JsonObject, TemporaryResourceBatch } from "../types.ts";
import schema from "./dhsheet-equipment.schema.json" with { type: "json" };

// 来源：https://dhsheet.site/自定义装备包指南和示例/equipment-pack.v1.schema.json（2026-10-16）。
const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addSchema(schema);
const validatePack = ajv.getSchema(schema.$id)!;
const validateWeapon = ajv.compile({ $ref: `${schema.$id}#/$defs/weaponTemplate` });
const validateArmor = ajv.compile({ $ref: `${schema.$id}#/$defs/armorTemplate` });

const aliases: Record<string, string> = {
  主武器: "primary", 副武器: "secondary",
  敏捷: "agility", 力量: "strength", 灵巧: "finesse", 本能: "instinct", 风度: "presence", 知识: "knowledge",
  物理: "physical", 魔法: "magic",
  近战: "melee", 邻近: "veryClose", 极近: "veryClose", 极近距离: "veryClose",
  近距离: "close", 远距离: "far", 极远: "veryFar", 极远距离: "veryFar",
  单手: "oneHanded", 双手: "twoHanded", 副手: "offHand",
};

function enumValue(value: unknown): string {
  const raw = text(value).trim();
  return aliases[raw] ?? raw;
}

function integerValue(value: unknown): string | number {
  const raw = text(value).trim();
  // 空值和规则表达式不能变成 0；保留原值，由装备包校验报告。
  return /^\d+$/u.test(raw) ? Number(raw) : raw;
}

function validationMessage(error: ErrorObject): string {
  const field = ({
    id: "ID", name: "名称", version: "版本", author: "作者", tier: "位阶", weaponType: "主副武器类型",
    trait: "属性", damageType: "伤害类型", range: "距离", burden: "负荷", damage: "伤害",
    featureName: "特性名称", description: "描述", baseArmorMax: "护甲值", minor: "重度伤害阈值", major: "严重伤害阈值",
  } as Record<string, string>)[error.instancePath.split("/").at(-1) ?? ""] ?? error.instancePath;
  if (error.keyword === "enum") return `${field}须为 ${error.params.allowedValues.join("、")}`;
  if (error.keyword === "type") return `${field}须为${error.params.type === "integer" ? "整数" : "文本"}`;
  if (error.keyword === "minimum") return `${field}不能小于 ${error.params.limit}`;
  if (error.keyword === "minLength") return `${field}不能为空`;
  if (error.keyword === "maxLength") return `${field}不能超过 ${error.params.limit} 个字符`;
  if (error.keyword === "not") return `${field}不能含斜杠、反斜杠或控制字符`;
  return `${field}格式无效`;
}

export function exportDhsheetEquipment(
  batch: TemporaryResourceBatch,
  options: ExportOptions,
): ExportResult {
  const resources = batch.resources.filter((resource) => resource.kind === "weapon" || resource.kind === "armor");
  if (resources.length === 0) return exportFailure("dhsheet", [{
    code: "dhsheet.equipment.empty", severity: "error", message: "资源包没有武器或护甲，未生成装备包。",
  }], 0);
  const weapons: JsonObject[] = [];
  const armor: JsonObject[] = [];
  const diagnostics: ConversionDiagnostic[] = [];
  const idCounts = new Map<string, number>();
  resources.forEach((resource) => idCounts.set(resource.sourceId, (idCounts.get(resource.sourceId) ?? 0) + 1));
  for (const resource of resources) {
    const fields = resource.fields;
    const tier = text(fields.位阶).trim().replace(/^T/iu, "");
    const record: JsonObject = {
      id: resource.sourceId,
      name: resource.name,
      tier: `T${tier}`,
      featureName: text(fields.特性名称),
      description: text(fields.特性描述),
      ...(resource.kind === "weapon" ? {
        weaponType: enumValue(fields.类型),
        trait: enumValue(fields.属性),
        damageType: enumValue(fields.伤害类型),
        range: enumValue(fields.距离),
        burden: enumValue(fields.负荷),
        damage: text(fields.伤害),
      } : {
        baseArmorMax: integerValue(fields.护甲值),
        baseThresholds: {
          minor: integerValue(fields.重度伤害阈值),
          major: integerValue(fields.严重伤害阈值),
        },
      }),
    };
    const validate = resource.kind === "weapon" ? validateWeapon : validateArmor;
    const problems: string[] = [];
    if (!validate(record)) {
      for (const error of validate.errors ?? []) {
        problems.push(validationMessage(error));
      }
    }
    if (idCounts.get(resource.sourceId)! > 1) problems.push("装备 ID 重复");
    if (resource.kind === "armor") {
      const thresholds = record.baseThresholds as JsonObject;
      if (typeof thresholds.minor === "number" && typeof thresholds.major === "number" && thresholds.major < thresholds.minor) {
        problems.push("严重伤害阈值不能小于重度伤害阈值");
      }
    }
    if (problems.length > 0) {
      diagnostics.push({
        code: "dhsheet.equipment.invalid", severity: "warning", resourceId: resource.sourceId,
        message: `装备包已跳过「${resource.name}」：${problems.join("；")}。导出卡牌包仍会保留该装备。`,
      });
      continue;
    }
    (resource.kind === "weapon" ? weapons : armor).push(record);
  }
  const converted = weapons.length + armor.length;
  if (converted === 0) return exportFailure("dhsheet", [...diagnostics, {
    code: "dhsheet.equipment.none-exportable", severity: "error", message: "没有符合 site 格式的装备，未生成文件。请修正上述字段后重试。",
  }], 0);
  const pack: JsonObject = {
    format: "daggerheart.equipment-pack.v1",
    name: options.packageName ?? batch.name,
    version: options.packageVersion ?? batch.version ?? "1.0.0",
    author: options.creator?.trim() || "未署名",
    description: "",
    equipment: { weapons, armor },
  };
  if (!validatePack(pack)) return exportFailure("dhsheet", [...diagnostics, {
    code: "dhsheet.equipment.invalid", severity: "error",
    message: `装备包信息不符合新版要求：${(validatePack.errors ?? []).map(validationMessage).join("；")}。`,
  }], 0);
  return { ok: true, artifact: jsonArtifact(pack, `${safeStem(text(pack.name))}-装备包.json`), report: report("dhsheet", "export", converted, diagnostics) };
}
