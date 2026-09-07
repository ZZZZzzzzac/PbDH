import type { ErrorObject, ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { supportedTemplates, type TemplateCoreCapability } from "@pbdh/templates/core";

import type { ConversionDiagnostic, JsonObject } from "./types.ts";

const validators = new Map<string, ValidateFunction>();
const templates = new Map(
  supportedTemplates.map((template) => [`${template.id}@${template.version}`, template]),
);

function validatorFor(
  id: string,
  version: string,
  template?: TemplateCoreCapability<any>,
): ValidateFunction | undefined {
  const key = `${id}@${version}`;
  const existing = validators.get(key);
  if (existing) return existing;
  const capability = template ?? templates.get(key);
  if (!capability || capability.id !== id || capability.version !== version) return undefined;
  // 历史模板版本可能复用 Schema ID，按精确模板版本隔离注册空间。
  const validator = new Ajv2020({ allErrors: true, strict: true }).compile(capability.schema);
  validators.set(key, validator);
  return validator;
}

function errorDiagnostic(error: ErrorObject): ConversionDiagnostic {
  return {
    code: "conversion.template-data.invalid",
    severity: "error",
    message: `Template 数据不满足 ${error.keyword} 约束。`,
    path: error.instancePath,
    details: { keyword: error.keyword },
  };
}

export function validateTemplateData(
  id: string,
  version: string,
  data: JsonObject,
  template?: TemplateCoreCapability<any>,
): ConversionDiagnostic[] {
  const validator = validatorFor(id, version, template);
  if (!validator) return [{
    code: "conversion.template.unsupported",
    severity: "error",
    message: `当前构建不支持 Template ${id}@${version}。`,
  }];
  return validator(data) ? [] : (validator.errors ?? []).map(errorDiagnostic);
}
