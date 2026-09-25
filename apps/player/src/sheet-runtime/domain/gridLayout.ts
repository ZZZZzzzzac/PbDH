import type { CardInstance } from "./cardEngine";
import type { CharacterData } from "./characterData";
import type { SystemPackage, CardTableModule } from "./systemPackage";
import { resolveResourceDefinition } from "./resourceDefinition";

import type { GridLayout } from "./gridLayoutContract";

export type GridMove = { instanceId: string; state: string; column: number; row: number; rotation: number };

export function gridSize(value: string | undefined, rotation = 0): { width: number; height: number } | null {
  const match = value?.trim().match(/^(\d+)\s*[×xX*]\s*(\d+)$/u);
  if (!match) return null;
  const width = Number(match[1]), height = Number(match[2]);
  if (width < 1 || height < 1 || width > 100 || height > 100) return null;
  return Math.abs(rotation % 180) === 90 ? { width: height, height: width } : { width, height };
}

export function gridContainers(layout: GridLayout, data: CharacterData) {
  return layout.容器.map((container) => {
    const read = (id: string, max: number) => {
      const value = Number(data.character.values[id]);
      return Number.isInteger(value) && value >= 0 && value <= max ? value : 0;
    };
    const rows = read(container.行数模块ID, layout.最大行数), columns = read(container.列数模块ID, layout.最大列数);
    const preset = container.尺寸选项?.find((option) => option.行数 === rows && option.列数 === columns) ?? container.尺寸选项?.[0];
    return { ...container, rows: preset?.行数 ?? rows, columns: preset?.列数 ?? columns };
  });
}

export function gridItem(data: CharacterData, system: SystemPackage, table: CardTableModule, item: CardInstance) {
  const definition = resolveResourceDefinition(system, data, item.definitionRef);
  const layout = table.网格布局!;
  return {
    item, definition,
    name: definition?.fields.名称 || "未命名物资",
    size: gridSize(definition?.fields[layout.尺寸字段], item.rotation),
    column: Math.round(item.xPct * layout.最大列数 / 100),
    row: Math.round(item.yPct * layout.最大行数 / 100),
  };
}

/** 移动、旋转一次提交；失败不修改原位置、状态或朝向。 */
export function moveGridItem(data: CharacterData, system: SystemPackage, move: GridMove): CharacterData {
  const item = data.cards.instances.find((entry) => entry.instanceId === move.instanceId);
  const table = system.modules.find((entry) => entry.ID === item?.tableModuleId);
  if (!item || table?.类型 !== "cardTable" || !table.网格布局) throw new Error("物资或格子桌面不存在。");
  const layout = table.网格布局;
  if (![0, 90, 180, 270].includes(move.rotation)) throw new Error("物资只能按90度旋转。");
  if (move.state !== layout.手上状态) {
    const containers = gridContainers(layout, data);
    const target = containers.find((entry) => entry.状态 === move.state);
    const size = gridItem(data, system, table, { ...item, rotation: move.rotation }).size;
    if (!size) throw new Error("该物资没有可装入背包的尺寸，请留在手上或载具中。");
    if (layout.容量上限 && containers.reduce((sum, entry) => sum + entry.rows * entry.columns, 0) > layout.容量上限) {
      throw new Error(`容器总容量超过${layout.容量上限}格，请先调整容器尺寸。`);
    }
    if (!target || !Number.isInteger(move.column) || !Number.isInteger(move.row)
      || move.column < 0 || move.row < 0 || move.column + size.width > target.columns || move.row + size.height > target.rows) {
      throw new Error("空间不足：物资不能越界或跨容器存放。");
    }
    for (const other of data.cards.instances) {
      if (other.instanceId === item.instanceId || other.tableModuleId !== table.ID || other.state !== move.state) continue;
      const occupied = gridItem(data, system, table, other);
      if (occupied.size && move.column < occupied.column + occupied.size.width && move.column + size.width > occupied.column
        && move.row < occupied.row + occupied.size.height && move.row + size.height > occupied.row) {
        throw new Error("这些格子已被其他物资占用。");
      }
    }
  }
  return { ...data, updatedAt: new Date().toISOString(), cards: { ...data.cards,
    instances: data.cards.instances.map((entry) => entry.instanceId !== item.instanceId ? entry : {
      ...entry, state: move.state, rotation: move.rotation,
      xPct: move.state === layout.手上状态 ? 0 : move.column * 100 / layout.最大列数,
      yPct: move.state === layout.手上状态 ? 0 : move.row * 100 / layout.最大行数,
    }),
  } };
}
