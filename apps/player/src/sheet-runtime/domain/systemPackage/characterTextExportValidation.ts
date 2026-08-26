import type { ValidationContext } from "./validationContext";

export function collectCharacterTextExportValidationIssues(context: ValidationContext): void {
  for (const [exportIndex, definition] of (context.systemPackage.characterTextExports ?? []).entries()) {
    for (const [fieldIndex, field] of definition.字段.entries()) {
      const path = `characterTextExports.${exportIndex}.字段.${fieldIndex}`;
      const module = context.moduleById.get(field.模块ID);
      if (!module) {
        context.issues.push({
          level: "error",
          code: "CHARACTER_TEXT_EXPORT_MODULE_MISSING",
          text: `Character Text Export「${definition.ID}」引用的 Module 不存在：${field.模块ID}`,
          path: `${path}.模块ID`,
        });
        continue;
      }

      const compatible = field.取值 === "文本"
        ? module.类型 === "freeText" || module.类型 === "longText"
        : module.类型 === "countableResource";
      if (!compatible) {
        context.issues.push({
          level: "error",
          code: "CHARACTER_TEXT_EXPORT_VALUE_INCOMPATIBLE",
          text: `Character Text Export「${definition.ID}」的取值「${field.取值}」不适用于 ${module.类型} Module「${field.模块ID}」。`,
          path: `${path}.取值`,
        });
      }
    }
  }
}
