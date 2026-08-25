import type { ErrorObject, ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { templateRegistry } from "@pbdh/templates/core";

import type { ConversionDiagnostic, JsonObject } from "./types.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validators = new Map<string, ValidateFunction>();

function validatorFor(id: string, version: string): ValidateFunction | undefined {
  const key = `${id}@${version}`;
  const existing = validators.get(key);
  if (existing) return existing;
  const template = templateRegistry.resolve(id, version);
  if (!template) return undefined;
  const validator = ajv.compile(template.schema);
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

export function validateTemplateData(id: string, version: string, data: JsonObject): ConversionDiagnostic[] {
  const validator = validatorFor(id, version);
  if (!validator) return [{
    code: "conversion.template.unsupported",
    severity: "error",
    message: `当前构建不支持 Template ${id}@${version}。`,
  }];
  return validator(data) ? [] : (validator.errors ?? []).map(errorDiagnostic);
}
