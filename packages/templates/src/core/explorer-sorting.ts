import { deepFreeze, type TemplateSortField } from "./types.ts";

export type { TemplateSortField } from "./types.ts";

const nameField: TemplateSortField = { key: "名称", label: "名称", kind: "text" };
const tierField: TemplateSortField = { key: "位阶", label: "位阶", kind: "number" };
const kindField: TemplateSortField = { key: "种类", label: "种类", kind: "text" };
const commonVersions = ["1.0.0", "1.0.1", "1.1.0"];

// 资源管理视图元数据独立于已发布模板行为；新版本须显式确认字段后登记。
const definitions: readonly {
  id: string;
  versions: readonly string[];
  fields: readonly TemplateSortField[];
}[] = [
  { id: "玩家卡", versions: ["1.0.0"], fields: [nameField, { key: "玩家名", label: "玩家名", kind: "text" }] },
  { id: "敌人", versions: [...commonVersions, "1.0.2", "1.0.3", "1.0.4", "1.0.5"], fields: [nameField, kindField, tierField] },
  { id: "种族", versions: commonVersions, fields: [nameField] },
  { id: "护甲", versions: commonVersions, fields: [nameField, tierField] },
  { id: "社群", versions: commonVersions, fields: [nameField] },
  { id: "领域卡", versions: commonVersions, fields: [
    nameField,
    { key: "领域", label: "领域", kind: "text" },
    { key: "等级", label: "等级", kind: "number" },
    { key: "回想", label: "回想", kind: "number" },
  ] },
  { id: "环境", versions: [...commonVersions, "1.0.2", "1.0.3"], fields: [nameField, tierField, kindField] },
  { id: "自由", versions: [...commonVersions, "1.0.2"], fields: [nameField] },
  { id: "物品", versions: commonVersions, fields: [nameField] },
  { id: "职业", versions: commonVersions, fields: [nameField] },
  { id: "子职业", versions: commonVersions, fields: [
    nameField,
    { key: "主职", label: "主职", kind: "text" },
    { key: "等级", label: "等级", kind: "enum", values: ["基础", "进阶", "精通"] },
  ] },
  { id: "武器", versions: commonVersions, fields: [nameField, tierField] },
];

const fieldsByTemplate = new Map(definitions.map(({ id, versions, fields }) => [
  id,
  new Map(versions.map((version) => [version, deepFreeze(fields)])),
]));
const emptyFields: readonly TemplateSortField[] = Object.freeze([]);

export function getTemplateSortingFields(id: string, version: string): readonly TemplateSortField[] {
  return fieldsByTemplate.get(id)?.get(version) ?? emptyFields;
}
