import { getResourceTextTemplateFields } from "../resourceTextTemplate";
import { findResourceLibrary, getResourcePickerLinks } from "./htmlTemplate";
import type { ValidationContext } from "./validationContext";
import {
  isCheckboxCondition,
  isResourceCondition,
  validateResourceLibraryField,
  validateSelectedResourceField,
} from "./validationHelpers";

export function collectDependencyValidationIssues(context: ValidationContext): void {
  const { systemPackage, issues, moduleById, pageById } = context;
  // --- Dependencies: structure, actions, write-targets ---

  const dependencyIds = new Set<string>();
  for (const dependency of systemPackage.dependencies ?? []) {
    if (dependencyIds.has(dependency.ID)) {
      issues.push({
        level: "error",
        code: "DUPLICATE_DEPENDENCY_ID",
        text: `Dependency Rule ID 重复：${dependency.ID}`,
        path: `dependencies.${dependency.ID}`,
      });
    }
    dependencyIds.add(dependency.ID);

    dependency.sources.forEach((source, sourceIndex) => {
      const sourceModule = moduleById.get(source.模块ID);
      if (!sourceModule) {
        issues.push({
          level: "error",
          code: "MISSING_DEPENDENCY_SOURCE_MODULE",
          text: `Dependency Rule sources 引用了不存在的模块：${source.模块ID}`,
          path: `dependencies.${dependency.ID}.sources.${sourceIndex}.模块ID`,
        });
        return;
      }

      if (sourceModule.类型 !== source.类型) {
        issues.push({
          level: "error",
          code: "UNSUPPORTED_DEPENDENCY_SOURCE_MODULE",
          text: `Dependency Rule source 类型与模块类型不匹配：${source.模块ID}`,
          path: `dependencies.${dependency.ID}.sources.${sourceIndex}.类型`,
        });
      }
    });

    dependency.targets.forEach((target, targetIndex) => {
      if (target.类型 === "module" && !moduleById.has(target.模块ID)) {
        issues.push({
          level: "error",
          code: "MISSING_DEPENDENCY_TARGET_MODULE",
          text: `Dependency Rule targets 引用了不存在的模块：${target.模块ID}`,
          path: `dependencies.${dependency.ID}.targets.${targetIndex}.模块ID`,
        });
      }

      if (target.类型 === "page" && !pageById.has(target.页面ID)) {
        issues.push({
          level: "error",
          code: "MISSING_DEPENDENCY_TARGET_PAGE",
          text: `Dependency Rule targets 引用了不存在的页面：${target.页面ID}`,
          path: `dependencies.${dependency.ID}.targets.${targetIndex}.页面ID`,
        });
      }
    });

    const sourceModule = moduleById.get(dependency.触发.来源模块ID);
    if (!sourceModule) {
      issues.push({
        level: "error",
        code: "MISSING_DEPENDENCY_SOURCE_MODULE",
        text: `Dependency Rule 引用了不存在的来源模块：${dependency.触发.来源模块ID}`,
        path: `dependencies.${dependency.ID}.触发.来源模块ID`,
      });
    } else if (dependency.触发.类型 === "resourceSelected" && sourceModule.类型 !== "resourcePicker" && sourceModule.类型 !== "resourceComposer") {
      issues.push({
        level: "error",
        code: "UNSUPPORTED_DEPENDENCY_SOURCE_MODULE",
        text: `resourceSelected 触发源必须是 Resource Picker 或 Resource Composer：${dependency.触发.来源模块ID}`,
        path: `dependencies.${dependency.ID}.触发.来源模块ID`,
      });
    } else if (dependency.触发.类型 === "checkboxChanged" && sourceModule.类型 !== "checkboxResource") {
      issues.push({
        level: "error",
        code: "UNSUPPORTED_DEPENDENCY_SOURCE_MODULE",
        text: `checkboxChanged 触发源必须是 Checkbox Resource：${dependency.触发.来源模块ID}`,
        path: `dependencies.${dependency.ID}.触发.来源模块ID`,
      });
    } else if (dependency.触发.类型 === "countableChanged" && sourceModule.类型 !== "countableResource") {
      issues.push({
        level: "error",
        code: "UNSUPPORTED_DEPENDENCY_SOURCE_MODULE",
        text: `countableChanged 触发源必须是 Countable Resource：${dependency.触发.来源模块ID}`,
        path: `dependencies.${dependency.ID}.触发.来源模块ID`,
      });
    } else if (dependency.触发.类型 === "freeTextChanged" && sourceModule.类型 !== "freeText") {
      issues.push({
        level: "error",
        code: "UNSUPPORTED_DEPENDENCY_SOURCE_MODULE",
        text: `freeTextChanged 触发源必须是 Free Text：${dependency.触发.来源模块ID}`,
        path: `dependencies.${dependency.ID}.触发.来源模块ID`,
      });
    }

    const hasDeclaredTriggerSource = dependency.sources.some((source) => source.模块ID === dependency.触发.来源模块ID);
    if (!hasDeclaredTriggerSource) {
      issues.push({
        level: "error",
        code: "MISSING_DEPENDENCY_TRIGGER_SOURCE_DECLARATION",
        text: `Dependency Rule sources 必须声明触发来源模块：${dependency.触发.来源模块ID}`,
        path: `dependencies.${dependency.ID}.sources`,
      });
    }

    if (isResourceCondition(dependency.条件) && dependency.触发.类型 !== "resourceSelected") {
      issues.push({
        level: "error",
        code: "UNSUPPORTED_DEPENDENCY_CONDITION",
        text: `selectedResourceField 条件只能用于 resourceSelected 触发：${dependency.ID}`,
        path: `dependencies.${dependency.ID}.条件.类型`,
      });
    }

    if (isResourceCondition(dependency.条件)) {
      validateSelectedResourceField(systemPackage, sourceModule, dependency.条件.字段, `dependencies.${dependency.ID}.条件.字段`, dependency.ID, issues);
    }

    if (isCheckboxCondition(dependency.条件) && dependency.触发.类型 !== "checkboxChanged") {
      issues.push({
        level: "error",
        code: "UNSUPPORTED_DEPENDENCY_CONDITION",
        text: `checkbox option 条件只能用于 checkboxChanged 触发：${dependency.ID}`,
        path: `dependencies.${dependency.ID}.条件.类型`,
      });
    }
    const checkboxCondition = isCheckboxCondition(dependency.条件) ? dependency.条件 : undefined;
    if (checkboxCondition && sourceModule?.类型 === "checkboxResource" && !sourceModule.选项.some((option) => option.ID === checkboxCondition.选项ID)) {
      issues.push({
        level: "error",
        code: "MISSING_CHECKBOX_OPTION_REFERENCE",
        text: `Dependency Rule ${dependency.ID} 引用了 Checkbox Resource ${sourceModule.ID} 中不存在的选项 ${checkboxCondition.选项ID}`,
        path: `dependencies.${dependency.ID}.条件.选项ID`,
        evidence: [{ label: "referencedOptionId", value: checkboxCondition.选项ID }, { label: "knownOptionIds", value: sourceModule.选项.map((option) => option.ID) }],
      });
    }

    dependency.动作.forEach((action, actionIndex) => {
      if (dependency.触发.类型 === "freeTextChanged" && action.类型 !== "setResourceDefaultFilter") {
        issues.push({
          level: "error",
          code: "UNSUPPORTED_DEPENDENCY_ACTION",
          text: `freeTextChanged 只允许 setResourceDefaultFilter：${dependency.ID}`,
          path: `dependencies.${dependency.ID}.动作.${actionIndex}.类型`,
        });
      }

      if (action.类型 === "fillText") {
        const targetModule = moduleById.get(action.目标模块ID);
        if (!targetModule) {
          issues.push({
            level: "error",
            code: "MISSING_DEPENDENCY_TARGET_MODULE",
            text: `Dependency Rule 引用了不存在的目标模块：${action.目标模块ID}`,
            path: `dependencies.${dependency.ID}.动作.${actionIndex}.目标模块ID`,
          });
          return;
        }

        if (targetModule.类型 !== "freeText" && targetModule.类型 !== "longText" && targetModule.类型 !== "readOnlyDisplay") {
          issues.push({
            level: "error",
            code: "UNSUPPORTED_DEPENDENCY_TARGET_MODULE",
            text: `fillText 目标模块必须是 Free Text、Long Text 或 ReadOnly Display：${action.目标模块ID}`,
            path: `dependencies.${dependency.ID}.动作.${actionIndex}.目标模块ID`,
          });
        }

        if (action.写入方式 === "追加" && (
          targetModule.类型 === "readOnlyDisplay"
          || (targetModule.类型 === "freeText" && targetModule.选项 !== undefined)
        )) {
          issues.push({
            level: "error",
            code: "UNSUPPORTED_APPEND_TARGET_MODULE",
            text: `fillText 追加目标必须是自由输入 Free Text 或 Long Text：${action.目标模块ID}`,
            path: `dependencies.${dependency.ID}.动作.${actionIndex}.目标模块ID`,
          });
        }

        if (typeof action.内容 !== "string" && dependency.触发.类型 !== "resourceSelected") {
          issues.push({
            level: "error",
            code: "UNSUPPORTED_DEPENDENCY_ACTION_CONTENT",
            text: `selectedResourceField 内容只能用于 resourceSelected 触发：${dependency.ID}`,
            path: `dependencies.${dependency.ID}.动作.${actionIndex}.内容.类型`,
          });
        }
        if (typeof action.内容 !== "string") {
          const content = action.内容;
          const fields = content.类型 === "selectedResourceField"
            ? [content.字段]
            : getResourceTextTemplateFields(content.格式);
          fields.forEach((field) => validateSelectedResourceField(
            systemPackage,
            sourceModule,
            field,
            `dependencies.${dependency.ID}.动作.${actionIndex}.内容.${content.类型 === "selectedResourceField" ? "字段" : "格式"}`,
            dependency.ID,
            issues,
          ));
        }
      }

      if (action.类型 === "fillCountable") {
        const targetModule = moduleById.get(action.目标模块ID);
        if (!targetModule) {
          issues.push({
            level: "error",
            code: "MISSING_DEPENDENCY_TARGET_MODULE",
            text: `Dependency Rule 引用了不存在的目标模块：${action.目标模块ID}`,
            path: `dependencies.${dependency.ID}.动作.${actionIndex}.目标模块ID`,
          });
          return;
        }
        if (targetModule.类型 !== "countableResource") {
          issues.push({
            level: "error",
            code: "UNSUPPORTED_DEPENDENCY_TARGET_MODULE",
            text: `fillCountable 目标模块必须是 Countable Resource：${action.目标模块ID}`,
            path: `dependencies.${dependency.ID}.动作.${actionIndex}.目标模块ID`,
          });
        }

        for (const [fieldName, content] of [["当前值", action.当前值], ["最大值", action.最大值]] as const) {
          if (!content || typeof content === "number") {
            continue;
          }
          if (content.类型 === "integerCalculation") {
            content.运算.forEach((operation, operationIndex) => {
              if (typeof operation.值 === "number") return;
              const operand = operation.值;
              const referencedModule = moduleById.get(operand.模块ID);
              const expectedType = operand.类型 === "countableCurrent" ? "countableResource" : "resourcePicker";
              if (!referencedModule) {
                issues.push({
                  level: "error",
                  code: "MISSING_DEPENDENCY_SOURCE_MODULE",
                  text: `integerCalculation 引用了不存在的模块：${operand.模块ID}`,
                  path: `dependencies.${dependency.ID}.动作.${actionIndex}.${fieldName}.运算.${operationIndex}.值.模块ID`,
                });
              } else if (referencedModule.类型 !== expectedType) {
                issues.push({
                  level: "error",
                  code: "UNSUPPORTED_DEPENDENCY_SOURCE_MODULE",
                  text: `integerCalculation ${operand.类型} 引用必须指向 ${expectedType}：${operand.模块ID}`,
                  path: `dependencies.${dependency.ID}.动作.${actionIndex}.${fieldName}.运算.${operationIndex}.值.模块ID`,
                });
              }
              if (!dependency.sources.some((source) => source.模块ID === operand.模块ID)) {
                issues.push({
                  level: "error",
                  code: "MISSING_DEPENDENCY_SOURCE_DECLARATION",
                  text: `Dependency Rule sources 必须声明 integerCalculation 来源模块：${operand.模块ID}`,
                  path: `dependencies.${dependency.ID}.sources`,
                });
              }
            });
            continue;
          }
          if (dependency.触发.类型 !== "resourceSelected") {
            issues.push({
              level: "error",
              code: "UNSUPPORTED_DEPENDENCY_ACTION_CONTENT",
              text: `fillCountable selectedResourceField 只能用于 resourceSelected 触发：${dependency.ID}`,
              path: `dependencies.${dependency.ID}.动作.${actionIndex}.${fieldName}.类型`,
            });
          }
          validateSelectedResourceField(systemPackage, sourceModule, content.字段, `dependencies.${dependency.ID}.动作.${actionIndex}.${fieldName}.字段`, dependency.ID, issues);
          if (sourceModule?.类型 === "resourcePicker" && sourceModule.多选 && content.选择索引 === undefined) {
            issues.push({
              level: "error",
              code: "COUNTABLE_SELECTION_INDEX_REQUIRED",
              text: `多选 Resource Picker 的 fillCountable selectedResourceField 必须声明选择索引：${dependency.ID}`,
              path: `dependencies.${dependency.ID}.动作.${actionIndex}.${fieldName}.选择索引`,
            });
          }
        }
      }

      if (action.类型 === "setVisibility") {
        if (action.目标类型 === "module" && !moduleById.has(action.目标ID)) {
          issues.push({
            level: "error",
            code: "MISSING_DEPENDENCY_TARGET_MODULE",
            text: `setVisibility 引用了不存在的目标模块：${action.目标ID}`,
            path: `dependencies.${dependency.ID}.动作.${actionIndex}.目标ID`,
          });
        }

        if (action.目标类型 === "page" && !pageById.has(action.目标ID)) {
          issues.push({
            level: "error",
            code: "MISSING_DEPENDENCY_TARGET_PAGE",
            text: `setVisibility 引用了不存在的目标页面：${action.目标ID}`,
            path: `dependencies.${dependency.ID}.动作.${actionIndex}.目标ID`,
          });
        }
      }

      if (action.类型 === "setResourceDefaultFilter") {
        const targetModule = moduleById.get(action.目标模块ID);
        if (!targetModule) {
          issues.push({
            level: "error",
            code: "MISSING_DEPENDENCY_TARGET_MODULE",
            text: `setResourceDefaultFilter 引用了不存在的目标模块：${action.目标模块ID}`,
            path: `dependencies.${dependency.ID}.动作.${actionIndex}.目标模块ID`,
          });
          return;
        }

        if (targetModule.类型 !== "resourcePicker") {
          issues.push({
            level: "error",
            code: "UNSUPPORTED_DEPENDENCY_TARGET_MODULE",
            text: `setResourceDefaultFilter 目标模块必须是 Resource Picker：${action.目标模块ID}`,
            path: `dependencies.${dependency.ID}.动作.${actionIndex}.目标模块ID`,
          });
        } else {
          for (const link of getResourcePickerLinks(targetModule)) {
            validateResourceLibraryField(findResourceLibrary(systemPackage, link.ID), action.字段, `dependencies.${dependency.ID}.动作.${actionIndex}.字段`, dependency.ID, targetModule.ID, issues);
          }
        }
        if (!Array.isArray(action.值) && action.值.类型 === "selectedResourceField") {
          if (dependency.触发.类型 !== "resourceSelected") {
            issues.push({
              level: "error",
              code: "UNSUPPORTED_DEPENDENCY_ACTION_CONTENT",
              text: `setResourceDefaultFilter selectedResourceField 只能用于 resourceSelected 触发：${dependency.ID}`,
              path: `dependencies.${dependency.ID}.动作.${actionIndex}.值.类型`,
            });
          }
          validateSelectedResourceField(systemPackage, sourceModule, action.值.字段, `dependencies.${dependency.ID}.动作.${actionIndex}.值.字段`, dependency.ID, issues);
        }
        if (!Array.isArray(action.值) && action.值.类型 === "freeTextValues") {
          if (dependency.触发.类型 !== "freeTextChanged") {
            issues.push({
              level: "error",
              code: "UNSUPPORTED_DEPENDENCY_ACTION_CONTENT",
              text: `setResourceDefaultFilter freeTextValues 只能用于 freeTextChanged 触发：${dependency.ID}`,
              path: `dependencies.${dependency.ID}.动作.${actionIndex}.值.类型`,
            });
          }
          action.值.模块IDs.forEach((moduleId, moduleIndex) => {
            const referencedModule = moduleById.get(moduleId);
            if (!referencedModule) {
              issues.push({
                level: "error",
                code: "MISSING_DEPENDENCY_SOURCE_MODULE",
                text: `freeTextValues 引用了不存在的模块：${moduleId}`,
                path: `dependencies.${dependency.ID}.动作.${actionIndex}.值.模块IDs.${moduleIndex}`,
              });
            } else if (referencedModule.类型 !== "freeText") {
              issues.push({
                level: "error",
                code: "UNSUPPORTED_DEPENDENCY_SOURCE_MODULE",
                text: `freeTextValues 来源必须是 Free Text：${moduleId}`,
                path: `dependencies.${dependency.ID}.动作.${actionIndex}.值.模块IDs.${moduleIndex}`,
              });
            }
            if (!dependency.sources.some((source) => source.类型 === "freeText" && source.模块ID === moduleId)) {
              issues.push({
                level: "error",
                code: "MISSING_DEPENDENCY_SOURCE_DECLARATION",
                text: `Dependency Rule sources 必须声明 freeTextValues 来源模块：${moduleId}`,
                path: `dependencies.${dependency.ID}.sources`,
              });
            }
          });
        }
      }

      if (action.类型 === "setTextPlaceholder") {
        const targetModule = moduleById.get(action.目标模块ID);
        if (!targetModule) {
          issues.push({
            level: "error",
            code: "MISSING_DEPENDENCY_TARGET_MODULE",
            text: `setTextPlaceholder 引用了不存在的目标模块：${action.目标模块ID}`,
            path: `dependencies.${dependency.ID}.动作.${actionIndex}.目标模块ID`,
          });
          return;
        }
        if (targetModule.类型 !== "freeText" && targetModule.类型 !== "longText") {
          issues.push({
            level: "error",
            code: "UNSUPPORTED_DEPENDENCY_TARGET_MODULE",
            text: `setTextPlaceholder 目标必须是 Free Text 或 Long Text：${action.目标模块ID}`,
            path: `dependencies.${dependency.ID}.动作.${actionIndex}.目标模块ID`,
          });
        }
        if (dependency.触发.类型 !== "resourceSelected") {
          issues.push({
            level: "error",
            code: "UNSUPPORTED_DEPENDENCY_ACTION_CONTENT",
            text: `setTextPlaceholder 只能用于 resourceSelected 触发：${dependency.ID}`,
            path: `dependencies.${dependency.ID}.动作.${actionIndex}.内容`,
          });
        }
        if (typeof action.内容 !== "string") {
          const fields = action.内容.类型 === "selectedResourceField"
            ? [action.内容.字段]
            : getResourceTextTemplateFields(action.内容.格式);
          fields.forEach((field) => validateSelectedResourceField(
            systemPackage,
            sourceModule,
            field,
            `dependencies.${dependency.ID}.动作.${actionIndex}.内容`,
            dependency.ID,
            issues,
          ));
        }
      }
    });
  }

}
