import type { ErrorObject, ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import type { TemplateCoreCapability } from "@pbdh/templates/core";

import type { ConversionDiagnostic, JsonObject } from "./types.ts";

const validators = new WeakMap<TemplateCoreCapability<any>, ValidateFunction>();

function validatorFor(
  id: string,
  version: string,
  capability: TemplateCoreCapability<any> | undefined,
): ValidateFunction | undefined {
  if (!capability || capability.id !== id || capability.version !== version) return undefined;
  const existing = validators.get(capability);
  if (existing) return existing;
  // 历史模板版本可能复用 Schema ID，按精确模板版本隔离注册空间。
  const validator = new Ajv2020({ allErrors: true, strict: true }).compile(capability.schema);
  validators.set(capability, validator);
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
  template: TemplateCoreCapability<any> | undefined,
): ConversionDiagnostic[] {
  const validator = validatorFor(id, version, template);
  if (!validator) return [{
    code: "conversion.template.unsupported",
    severity: "error",
    message: `当前构建不支持 Template ${id}@${version}。`,
  }];
  return validator(data) ? [] : (validator.errors ?? []).map(errorDiagnostic);
}
