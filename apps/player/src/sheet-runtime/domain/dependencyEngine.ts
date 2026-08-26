import { updateCharacterValue, type CharacterData, type CheckboxState, type CountableState, type SheetValue } from "./characterData";
import { findResourceLibraryEntry } from "./resourceLibrary";
import type { ResourceLibraryEntry, ResourceLibraryQuery } from "./resourceLibrary";
import { findModule, getResourcePickerLinks, type DependencyAction, type DependencyCondition, type SystemPackage } from "./systemPackage";
import { formatResourceTextTemplate } from "./resourceTextTemplate";
import { clampInt } from "../utils";

export interface CardCreationInstruction {
  moduleId: string;
  cardTableModuleId: string;
  entries: ResourceLibraryEntry[];
  libraryId?: string;
  defaultState?: string;
}

export interface ResourceSelectedEvent {
  type: "resourceSelected";
  sourceModuleId: string;
  libraryId?: string;
  selectedEntries: ResourceLibraryEntry[];
}

export interface CheckboxChangedEvent {
  type: "checkboxChanged";
  sourceModuleId: string;
  optionId?: string;
  checked: boolean;
  checkboxState: CheckboxState;
}

export interface CountableChangedEvent {
  type: "countableChanged";
  sourceModuleId: string;
  countableState: CountableState;
}

export interface FreeTextChangedEvent {
  type: "freeTextChanged";
  sourceModuleId: string;
  value: string;
}

export type DependencyEvent = ResourceSelectedEvent | CheckboxChangedEvent | CountableChangedEvent | FreeTextChangedEvent;

export interface DependencyEvaluationResult {
  dataPatches: Record<string, SheetValue>;
  readOnlyDisplayContent: Record<string, string>;
  textPlaceholders: Record<string, string>;
  moduleVisibility: Record<string, boolean>;
  pageVisibility: Record<string, boolean>;
  resourcePickerDefaultQueries: Record<string, ResourceLibraryQuery>;
  warnings: string[];
  cardCreationInstructions: CardCreationInstruction[];
}

export function createEmptyDependencyEvaluationResult(): DependencyEvaluationResult {
  return {
    dataPatches: {},
    readOnlyDisplayContent: {},
    textPlaceholders: {},
    moduleVisibility: {},
    pageVisibility: {},
    resourcePickerDefaultQueries: {},
    warnings: [],
    cardCreationInstructions: [],
  };
}

export function evaluateDependencies(
  data: CharacterData,
  systemPackage: SystemPackage,
  event: DependencyEvent,
): DependencyEvaluationResult {
  const result = createEmptyDependencyEvaluationResult();
  const writtenTargets = new Map<string, { ruleId: string; value: string }>();

  for (const rule of systemPackage.dependencies ?? []) {
    if (!eventMatchesTrigger(event, rule.触发.类型, rule.触发.来源模块ID)) {
      continue;
    }
    if (!conditionMatches(rule.条件, event)) {
      continue;
    }

    for (const action of rule.动作) {
      applyAction({
        action,
        data,
        systemPackage,
        event,
        result,
        ruleId: rule.ID,
        writtenTargets,
      });
    }
  }

  if (event.type === "resourceSelected") {
    const sourceModule = findModule(systemPackage, event.sourceModuleId);
    const config = (sourceModule as Record<string, unknown> | undefined)?.创建卡牌 as { 卡牌桌面模块ID?: string; 默认状态?: string } | undefined;
    if (config?.卡牌桌面模块ID && event.selectedEntries.length > 0) {
      result.cardCreationInstructions.push({
        moduleId: event.sourceModuleId,
        cardTableModuleId: config.卡牌桌面模块ID,
        entries: event.selectedEntries,
        libraryId: event.libraryId,
        defaultState: config.默认状态,
      });
    }
  }

  return result;
}

export function hasRebuildableDependencies(systemPackage: SystemPackage, sourceModuleId: string): boolean {
  return (systemPackage.dependencies ?? []).some((rule) =>
    rule.触发.类型 === "resourceSelected"
    && rule.触发.来源模块ID === sourceModuleId
    && rule.动作.some((action) => isRebuildableAction(action, systemPackage)),
  ) || (systemPackage.dependencies ?? []).some((rule) => rule.动作.some((action) =>
    action.类型 === "fillCountable"
    && [action.当前值, action.最大值].some((content) => content && typeof content === "object"
      && content.类型 === "integerCalculation"
      && content.运算.some((operation) => typeof operation.值 === "object"
        && operation.值.类型 === "resourceSelectionCount"
        && operation.值.模块ID === sourceModuleId)),
  ));
}

export function rebuildDerivedDependencies(
  data: CharacterData,
  systemPackage: SystemPackage,
): DependencyEvaluationResult {
  const result = createEmptyDependencyEvaluationResult();
  const writtenTargets = new Map<string, { ruleId: string; value: string }>();
  const events = new Map<string, DependencyEvent | null>();

  for (const rule of systemPackage.dependencies ?? []) {
    const sourceModuleId = rule.触发.来源模块ID;
    if (!events.has(sourceModuleId)) {
      events.set(sourceModuleId, resolveDerivedSourceEvent(data, systemPackage, sourceModuleId, result));
    }
    const event = events.get(sourceModuleId);
    if (!event || !eventMatchesTrigger(event, rule.触发.类型, sourceModuleId) || !conditionMatches(rule.条件, event)) continue;

    for (const action of rule.动作) {
      if (!isRebuildableAction(action, systemPackage)) continue;
      applyAction({ action, data, systemPackage, event, result, ruleId: rule.ID, writtenTargets });
    }
  }


  return result;
}

export function applyDependencyResultToCharacterData(data: CharacterData, result: DependencyEvaluationResult): CharacterData {
  let nextData = data;

  for (const [moduleId, value] of Object.entries(result.dataPatches)) {
    nextData = updateCharacterValue(nextData, moduleId, value);
  }

  return nextData;
}

function eventMatchesTrigger(event: DependencyEvent, triggerType: string, sourceModuleId: string): boolean {
  return event.type === triggerType && event.sourceModuleId === sourceModuleId;
}

function conditionMatches(condition: DependencyCondition | undefined, event: DependencyEvent): boolean {
  if (!condition || condition.类型 === "always") {
    return true;
  }

  switch (condition.类型) {
    case "selectedResourceFieldEquals":
      return event.type === "resourceSelected" && selectedFieldValues(event, condition.字段).some((value) => value === condition.值);
    case "selectedResourceFieldIn":
      return event.type === "resourceSelected" && selectedFieldValues(event, condition.字段).some((value) => condition.值.includes(value));
    case "selectedResourceFieldNotEquals":
      return event.type === "resourceSelected" && selectedFieldValues(event, condition.字段).every((value) => value !== condition.值);
    case "checkboxOptionChecked":
      return event.type === "checkboxChanged" && event.checkboxState[condition.选项ID] === true;
    case "checkboxOptionUnchecked":
      return event.type === "checkboxChanged" && event.checkboxState[condition.选项ID] !== true;
    default:
      return false;
  }
}

function applyAction({
  action,
  data,
  systemPackage,
  event,
  result,
  ruleId,
  writtenTargets,
}: {
  action: DependencyAction;
  data: CharacterData;
  systemPackage: SystemPackage;
  event: DependencyEvent;
  result: DependencyEvaluationResult;
  ruleId: string;
  writtenTargets: Map<string, { ruleId: string; value: string }>;
}) {
  switch (action.类型) {
    case "fillText": {
      const targetModule = findModule(systemPackage, action.目标模块ID);
      const value = fillTextValue(action.内容, event);
      const targetKey = `text:${action.目标模块ID}`;
      recordWrite(result, writtenTargets, targetKey, `text target ${action.目标模块ID}`, ruleId, value);

      if (targetModule?.类型 === "readOnlyDisplay") {
        if (action.写入方式 !== "追加") {
          result.readOnlyDisplayContent[action.目标模块ID] = value;
        }
        return;
      }

      if (targetModule?.类型 === "freeText" || targetModule?.类型 === "longText") {
        if (action.写入方式 === "追加") {
          const pendingValue = result.dataPatches[action.目标模块ID];
          const storedValue = data.character.values[action.目标模块ID];
          const existingValue = typeof pendingValue === "string"
            ? pendingValue
            : typeof storedValue === "string" ? storedValue : "";
          result.dataPatches[action.目标模块ID] = appendText(existingValue, value, action.追加分隔符 ?? "\n\n");
        } else {
          result.dataPatches[action.目标模块ID] = value;
        }
      }
      return;
    }

    case "fillCountable": {
      const targetModule = findModule(systemPackage, action.目标模块ID);
      if (targetModule?.类型 !== "countableResource") {
        return;
      }
      const existingPatch = result.dataPatches[action.目标模块ID];
      const existingValue = isCountableState(existingPatch) ? existingPatch : data.character.values[action.目标模块ID];
      const min = targetModule.最小值 ?? 0;
      const initial: CountableState = isCountableState(existingValue)
        ? existingValue
        : { current: clampInt(targetModule.默认值 ?? min, min, targetModule.最大值 ?? null), max: targetModule.最大值 ?? null };
      const current = resolveCountableValue(action.当前值, data, systemPackage, event, result, ruleId, "current");
      const maximum = action.最大值 === null
        ? null
        : resolveCountableValue(action.最大值, data, systemPackage, event, result, ruleId, "maximum");

      if (action.当前值 !== undefined && current !== undefined) {
        recordWrite(result, writtenTargets, `countable:${action.目标模块ID}:current`, `countable current ${action.目标模块ID}`, ruleId, String(current));
      }
      if (action.最大值 !== undefined && (action.最大值 === null || maximum !== undefined)) {
        recordWrite(result, writtenTargets, `countable:${action.目标模块ID}:maximum`, `countable maximum ${action.目标模块ID}`, ruleId, String(action.最大值 === null ? null : maximum));
      }

      let nextMax: number | null = initial.max;
      if (action.最大值 === null) {
        nextMax = null;
      } else if (typeof maximum === "number") {
        nextMax = Math.max(min, maximum);
      }
      const nextCurrentInput = typeof current === "number" ? current : initial.current;
      result.dataPatches[action.目标模块ID] = {
        current: clampInt(nextCurrentInput, min, nextMax),
        max: nextMax,
      };
      return;
    }

    case "setTextPlaceholder": {
      const value = fillTextValue(action.内容, event);
      const targetKey = `textPlaceholder:${action.目标模块ID}`;
      recordWrite(result, writtenTargets, targetKey, `text placeholder ${action.目标模块ID}`, ruleId, value);
      result.textPlaceholders[action.目标模块ID] = value;
      return;
    }

    case "setVisibility": {
      const targetKey = `visibility:${action.目标类型}:${action.目标ID}`;
      recordWrite(result, writtenTargets, targetKey, `${action.目标类型} visibility ${action.目标ID}`, ruleId, String(action.显示));

      if (action.目标类型 === "page") {
        result.pageVisibility[action.目标ID] = action.显示;
        return;
      }

      result.moduleVisibility[action.目标ID] = action.显示;
      return;
    }

    case "setResourceDefaultFilter": {
      const values = Array.isArray(action.值)
        ? action.值
        : action.值.类型 === "selectedResourceField"
          ? event.type === "resourceSelected"
            ? action.值.选择索引 === undefined
              ? selectedFieldValues(event, action.值.字段)
              : [event.selectedEntries[action.值.选择索引]?.fields[action.值.字段] ?? ""]
            : []
          : [...new Set(action.值.模块IDs
            .map((moduleId) => data.character.values[moduleId])
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter(Boolean))];
      const targetKey = `resourceDefaultFilter:${action.目标模块ID}:${action.字段}`;
      recordWrite(result, writtenTargets, targetKey, `resource picker default filter ${action.目标模块ID}.${action.字段}`, ruleId, JSON.stringify(values));

      const currentQuery = result.resourcePickerDefaultQueries[action.目标模块ID] ?? {};
      result.resourcePickerDefaultQueries[action.目标模块ID] = {
        ...currentQuery,
        filters: {
          ...(currentQuery.filters ?? {}),
          [action.字段]: values,
        },
      };
      return;
    }
  }

}

function resolveCountableValue(
  content: Extract<DependencyAction, { 类型: "fillCountable" }>["当前值"] | Extract<DependencyAction, { 类型: "fillCountable" }>["最大值"],
  data: CharacterData,
  systemPackage: SystemPackage,
  event: DependencyEvent,
  result: DependencyEvaluationResult,
  ruleId: string,
  field: "current" | "maximum",
): number | null | undefined {
  if (content === undefined || content === null || typeof content === "number") {
    return content;
  }
  if (content.类型 === "integerCalculation") {
    let value = content.初始值;
    for (const operation of content.运算) {
      const operand = resolveIntegerOperand(operation.值, data, systemPackage);
      const nextValue = operation.操作 === "add" ? value + operand : value - operand;
      if (!Number.isSafeInteger(nextValue)) {
        result.warnings.push(`Dependency ${ruleId} skipped unsafe countable ${field} integer calculation.`);
        return undefined;
      }
      value = nextValue;
    }
    if (content.最小值 !== undefined) value = Math.max(content.最小值, value);
    if (content.最大值 !== undefined) value = Math.min(content.最大值, value);
    return value;
  }
  if (event.type !== "resourceSelected") {
    return undefined;
  }
  const raw = event.selectedEntries[content.选择索引 ?? 0]?.fields[content.字段] ?? "";
  const trimmed = raw.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) {
    result.warnings.push(`Dependency ${ruleId} skipped invalid countable ${field} integer: ${JSON.stringify(raw)}.`);
    return undefined;
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value)) {
    result.warnings.push(`Dependency ${ruleId} skipped unsafe countable ${field} integer: ${JSON.stringify(raw)}.`);
    return undefined;
  }
  return value;
}

function resolveIntegerOperand(
  operand: number | { 类型: "countableCurrent"; 模块ID: string } | { 类型: "resourceSelectionCount"; 模块ID: string },
  data: CharacterData,
  systemPackage: SystemPackage,
): number {
  if (typeof operand === "number") return operand;
  if (operand.类型 === "resourceSelectionCount") {
    return data.resourceSelections?.[operand.模块ID]?.entryIds.length ?? 0;
  }
  const stored = data.character.values[operand.模块ID];
  if (isCountableState(stored)) return stored.current;
  const module = findModule(systemPackage, operand.模块ID);
  return module?.类型 === "countableResource" ? module.默认值 ?? module.最小值 ?? 0 : 0;
}

function isCountableState(value: SheetValue | undefined): value is CountableState {
  return typeof value === "object" && value !== null && "current" in value && "max" in value;
}

function recordWrite(
  result: DependencyEvaluationResult,
  writtenTargets: Map<string, { ruleId: string; value: string }>,
  key: string,
  label: string,
  ruleId: string,
  value: string,
) {
  const previous = writtenTargets.get(key);
  if (previous && previous.value !== value) {
    result.warnings.push(`Dependency conflict on ${label}: ${previous.ruleId} overwritten by ${ruleId}.`);
  }
  writtenTargets.set(key, { ruleId, value });
}

function isRebuildableAction(action: DependencyAction, systemPackage: SystemPackage): boolean {
  if (action.类型 === "setVisibility" || action.类型 === "setResourceDefaultFilter" || action.类型 === "setTextPlaceholder") return true;
  if (action.类型 !== "fillText" || action.写入方式 === "追加") return false;
  return findModule(systemPackage, action.目标模块ID)?.类型 === "readOnlyDisplay";
}

function resolveDerivedSourceEvent(
  data: CharacterData,
  systemPackage: SystemPackage,
  sourceModuleId: string,
  result: DependencyEvaluationResult,
): DependencyEvent | null {
  const sourceModule = findModule(systemPackage, sourceModuleId);
  if (sourceModule?.类型 === "checkboxResource") {
    const checkboxState = data.character.values[sourceModuleId];
    if (!isCheckboxState(checkboxState)) return null;
    return { type: "checkboxChanged", sourceModuleId, checked: false, checkboxState };
  }
  if (sourceModule?.类型 === "resourceComposer") {
    const composite = data.compositeResources[sourceModuleId];
    return composite
      ? { type: "resourceSelected", sourceModuleId, selectedEntries: [composite] }
      : null;
  }
  if (sourceModule?.类型 === "freeText") {
    const storedValue = data.character.values[sourceModuleId];
    return {
      type: "freeTextChanged",
      sourceModuleId,
      value: typeof storedValue === "string" ? storedValue : sourceModule.默认值 ?? "",
    };
  }
  if (sourceModule?.类型 !== "resourcePicker") return null;

  const snapshot = data.resourceSelections?.[sourceModuleId];
  if (!snapshot) return null;
  if (!getResourcePickerLinks(sourceModule).some((link) => link.ID === snapshot.libraryId)) {
    result.warnings.push(`Derived source ${sourceModuleId} skipped mismatched Resource Library ${snapshot.libraryId}.`);
    return null;
  }
  const library = (systemPackage.resourceLibraries ?? []).find((candidate) => candidate.ID === snapshot.libraryId);
  if (!library) {
    result.warnings.push(`Derived source ${sourceModuleId} skipped missing Resource Library ${snapshot.libraryId}.`);
    return null;
  }
  const entries = snapshot.entryIds.map((entryId) => findResourceLibraryEntry(library, entryId));
  const missingEntryId = snapshot.entryIds.find((_, index) => !entries[index]);
  if (missingEntryId) {
    result.warnings.push(`Derived source ${sourceModuleId} skipped missing Resource Entry ${snapshot.libraryId}/${missingEntryId}.`);
    return null;
  }
  return {
    type: "resourceSelected",
    sourceModuleId,
    libraryId: snapshot.libraryId,
    selectedEntries: entries as ResourceLibraryEntry[],
  };
}

function isCheckboxState(value: SheetValue | undefined): value is CheckboxState {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !("current" in value) && !("kind" in value);
}

function fillTextValue(content: Extract<DependencyAction, { 类型: "fillText" }>["内容"], event: DependencyEvent): string {
  if (typeof content === "string") {
    return content;
  }

  if (event.type !== "resourceSelected") {
    return "";
  }

  if (content.类型 === "selectedResourceField") {
    return selectedFieldText(event.selectedEntries, content.字段, content.选择索引, content.分隔符);
  }

  const entries = content.选择索引 === undefined
    ? event.selectedEntries
    : event.selectedEntries.slice(content.选择索引, content.选择索引 + 1);
  return entries.map((entry) => formatResourceTextTemplate(content.格式, entry.fields)).join(content.分隔符 ?? "\n\n");
}

function appendText(existingValue: string, addedValue: string, separator: string): string {
  if (!existingValue) return addedValue;
  if (!addedValue) return existingValue;
  return `${existingValue}${separator}${addedValue}`;
}

function selectedFieldValues(event: ResourceSelectedEvent, field: string): string[] {
  return event.selectedEntries.map((entry) => entry.fields[field] ?? "");
}

function selectedFieldText(entries: ResourceLibraryEntry[], field: string, selectedIndex?: number, separator = "\n\n") {
  if (selectedIndex !== undefined) {
    return entries[selectedIndex]?.fields[field] ?? "";
  }

  return entries.map((entry) => entry.fields[field] ?? "").join(separator);
}
