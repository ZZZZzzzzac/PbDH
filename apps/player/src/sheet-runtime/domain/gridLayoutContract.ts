import Ajv2020 from "ajv/dist/2020.js";
import schema from "../../../../../contracts/system-package/1.0.0/grid-layout.schema.json";
export interface GridLayout {
  版本: "1.0.0";
  尺寸字段: string;
  手上状态: string;
  最大列数: number;
  最大行数: number;
  容量上限?: number;
  大件记录模块ID?: string;
  容器: Array<{ 状态: string; 名称: string; 行数模块ID: string; 列数模块ID: string; 尺寸选项?: Array<{ 名称: string; 行数: number; 列数: number }> }>;
}
export const validateGridLayout = new Ajv2020({ strict: true }).compile<GridLayout>(schema);
