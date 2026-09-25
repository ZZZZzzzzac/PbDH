import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import type { CardTableModule, SystemPackage } from "../domain/systemPackage";
import { gridContainers, gridItem, moveGridItem } from "../domain/gridLayout";
import { useRuntimeStore } from "../store/runtimeStore";
import "./gridInventory.css";

export function GridInventoryModule({ module, systemPackage }: { module: CardTableModule; systemPackage: SystemPackage }) {
  const data = useRuntimeStore((state) => state.characterData);
  const move = useRuntimeStore((state) => state.moveGridItem);
  const update = useRuntimeStore((state) => state.updateModuleValue);
  const remove = useRuntimeStore((state) => state.deleteCardInstance);
  const [selected, select] = useState<string | null>(null);
  const [message, report] = useState("");
  const [hover, setHover] = useState<{ state: string; column: number; row: number } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const [toolbar, setToolbar] = useState<Element | null>(null);
  useLayoutEffect(() => { setToolbar(rootRef.current?.closest(".hopefind-page")?.querySelector(".inventory-size-slot") ?? null); }, []);
  const drag = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  if (!data || !module.网格布局) return null;
  const layout = module.网格布局;
  const containers = gridContainers(layout, data);
  const items = data.cards.instances.filter((item) => item.tableModuleId === module.ID).map((item) => gridItem(data, systemPackage, module, item));
  const current = items.find((item) => item.item.instanceId === selected);
  const dragged = items.find((item) => item.item.instanceId === draggedId);
  const contained = (item: typeof items[number]) => containers.some((bag) => bag.状态 === item.item.state && item.size
    && item.column >= 0 && item.row >= 0 && item.column + item.size.width <= bag.columns && item.row + item.size.height <= bag.rows);
  const hand = items.filter((item) => !contained(item));
  let previewError = false;
  if (hover && dragged) {
    try { moveGridItem(data, systemPackage, { instanceId: dragged.item.instanceId, state: hover.state, column: hover.column, row: hover.row, rotation: dragged.item.rotation }); }
    catch { previewError = true; }
  }

  const commit = (id: string, state: string, column = 0, row = 0, rotate = false) => {
    const item = items.find((candidate) => candidate.item.instanceId === id);
    if (!item) return;
    const error = move({ instanceId: id, state, column, row, rotation: rotate ? (item.item.rotation + 90) % 360 : item.item.rotation });
    report(error ?? "");
  };
  const locate = (x: number, y: number) => {
    const zone = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-grid-zone]");
    if (!zone || zone.dataset.gridTable !== module.ID) return null;
    const state = zone.dataset.gridZone!;
    if (state === layout.手上状态) return { state, column: 0, row: 0 };
    const bag = containers.find((entry) => entry.状态 === state);
    if (!bag) return null;
    const box = zone.getBoundingClientRect();
    return { state, column: Math.floor((x - box.left) * layout.最大列数 / box.width), row: Math.floor((y - box.top) * layout.最大行数 / box.height) };
  };
  const start = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0) return;
    select(id);
    drag.current = { id, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const tile = (item: typeof items[number], placed: boolean) => {
    const size = item.size ?? { width: 2, height: 1 };
    const style: CSSProperties = placed
      ? { gridColumn: `${item.column + 1} / span ${size.width}`, gridRow: `${item.row + 1} / span ${size.height}` }
      : {};
    return <button key={item.item.instanceId} type="button" className={`gi-item${selected === item.item.instanceId ? " gi-selected" : ""}`}
      style={style} aria-label={`${item.name}，${item.size ? `${size.width}×${size.height}` : "大件"}，${placed ? item.item.state : layout.手上状态}`}
      aria-pressed={selected === item.item.instanceId} title={`${item.name} · 右键旋转`}
      onClick={(event) => { event.stopPropagation(); select(item.item.instanceId); }}
      onPointerDown={(event) => start(event, item.item.instanceId)}
      onPointerMove={(event) => {
        const active = drag.current;
        if (!active) return;
        if (Math.hypot(event.clientX - active.x, event.clientY - active.y) > 4) active.moved = true;
        if (active.moved) {
          const target = locate(event.clientX, event.clientY);
          setHover(target);
          setDraggedId(active.id);
        }
      }}
      onPointerUp={(event) => {
        const active = drag.current; drag.current = null; setHover(null); setDraggedId(null);
        if (!active?.moved) return;
        const target = locate(event.clientX, event.clientY);
        if (target) commit(active.id, target.state, target.column, target.row);
        else report("请放到手上区域或背包格子内。");
      }}
      onPointerCancel={() => { drag.current = null; setHover(null); setDraggedId(null); }}
      onContextMenu={(event) => { event.preventDefault(); select(item.item.instanceId); commit(item.item.instanceId, placed ? item.item.state : layout.手上状态, item.column, item.row, true); }}>
      <span>{item.name}</span><small>{item.size ? `${size.width}×${size.height}` : "大件"}</small>
    </button>;
  };
  return <section ref={rootRef} className="grid-inventory" data-module-id={module.ID} aria-label={module.标签}>
    <div className="gi-hand" data-grid-zone={layout.手上状态} data-grid-table={module.ID}>
      <header><strong>{layout.手上状态}</strong><span>{hand.length} 件</span></header>
      <div className="gi-hand-items">{hand.length ? hand.map((item) => tile(item, false)) : <p>领取的物资会先放在这里。</p>}</div>
    </div>
    <p className="gi-help">拖动放置，右键旋转。也可选中物资后点击空格放置；越界或重叠会保留原位。</p>
    <div className="gi-bags">{containers.map((bag) => <section className="gi-bag" key={bag.状态}>
      {toolbar ? createPortal(<div className="gi-size-control">{bag.尺寸选项 ? <select aria-label={`${bag.名称}尺寸`} value={`${bag.rows}×${bag.columns}`} onChange={(event) => {
        const preset = bag.尺寸选项!.find((option) => `${option.行数}×${option.列数}` === event.target.value);
        if (preset) { update(bag.行数模块ID, String(preset.行数)); update(bag.列数模块ID, String(preset.列数)); }
      }}>{bag.尺寸选项.map((preset) => <option key={preset.名称} value={`${preset.行数}×${preset.列数}`}>{preset.名称}</option>)}</select> : <><label>行<select aria-label={`${bag.名称}行数`} value={bag.rows} onChange={(event) => update(bag.行数模块ID, event.target.value)}>
        {Array.from({ length: layout.最大行数 + 1 }, (_, index) => <option key={index}>{index}</option>)}
      </select></label><label>列<select aria-label={`${bag.名称}列数`} value={bag.columns} onChange={(event) => update(bag.列数模块ID, event.target.value)}>
        {Array.from({ length: layout.最大列数 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}
      </select></label></>}</div>, toolbar, bag.状态) : <div className="gi-size-control">{bag.尺寸选项 ? <select aria-label={`${bag.名称}尺寸`} value={`${bag.rows}×${bag.columns}`} onChange={(event) => {
        const preset = bag.尺寸选项!.find((option) => `${option.行数}×${option.列数}` === event.target.value);
        if (preset) { update(bag.行数模块ID, String(preset.行数)); update(bag.列数模块ID, String(preset.列数)); }
      }}>{bag.尺寸选项.map((preset) => <option key={preset.名称} value={`${preset.行数}×${preset.列数}`}>{preset.名称}</option>)}</select> : <><label>行<select aria-label={`${bag.名称}行数`} value={bag.rows} onChange={(event) => update(bag.行数模块ID, event.target.value)}>
        {Array.from({ length: layout.最大行数 + 1 }, (_, index) => <option key={index}>{index}</option>)}
      </select></label><label>列<select aria-label={`${bag.名称}列数`} value={bag.columns} onChange={(event) => update(bag.列数模块ID, event.target.value)}>
        {Array.from({ length: layout.最大列数 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}
      </select></label></>}</div>}

      {bag.rows > 0 && bag.columns > 0 ? <GridBoard rows={layout.最大行数} columns={layout.最大列数}><div className="gi-grid" role="group" aria-label={`${bag.名称} ${bag.columns}列${bag.rows}行`}
        data-grid-zone={bag.状态} data-grid-table={module.ID}
        style={{ gridTemplateColumns: `repeat(${layout.最大列数}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${layout.最大行数}, minmax(0, 1fr))` }}>
        <div className="gi-watermark" aria-hidden="true">{bag.名称}</div>
        {Array.from({ length: layout.最大行数 * layout.最大列数 }, (_, index) => {
          const row = Math.floor(index / layout.最大列数), column = index % layout.最大列数;
          return <button key={index} disabled={row >= bag.rows || column >= bag.columns} className={`gi-cell${row >= bag.rows || column >= bag.columns ? " gi-masked" : ""}`}
            style={{ gridColumn: column + 1, gridRow: row + 1 }} type="button" aria-label={`${bag.名称}第${row + 1}行第${column + 1}格`}
            onClick={() => selected && commit(selected, bag.状态, column, row)} />;
        })}
        {items.filter((item) => item.item.state === bag.状态 && contained(item)).map((item) => tile(item, true))}
        {hover?.state === bag.状态 && dragged?.size && <div aria-hidden="true" className={`gi-drop-preview${previewError ? " gi-invalid" : ""}`} style={{
          left: `${hover.column * 100 / layout.最大列数}%`, top: `${hover.row * 100 / layout.最大行数}%`,
          width: `${dragged.size.width * 100 / layout.最大列数}%`, height: `${dragged.size.height * 100 / layout.最大行数}%`,
        }}>{dragged.name}</div>}

      </div></GridBoard> : <p className="gi-help">未启用</p>}
    </section>)}</div>
    <p className="gi-capacity">容量：{containers.reduce((sum, bag) => sum + bag.rows * bag.columns, 0)}{layout.容量上限 ? ` / ${layout.容量上限}` : ""} 格。缩小容器后放不下的物资会显示在手上，内容不会丢失。</p>
    {message && <div className="gi-feedback" role="alert">{message}</div>}
    <section className="gi-detail">{current ? <><header><div className="gi-detail-title"><strong>{current.name}</strong><span>{current.definition?.fields.内容1描述}</span></div><div className="gi-detail-actions">
      <button type="button" onClick={() => commit(current.item.instanceId, contained(current) ? current.item.state : layout.手上状态, current.column, current.row, true)}>旋转90°</button>
      <button type="button" onClick={() => commit(current.item.instanceId, layout.手上状态)}>拿回手上</button>
      <button type="button" onClick={() => { remove(current.item.instanceId); select(null); report(""); }}>移除物资</button>
    </div></header><p title={current.definition?.fields.内容2描述}>{current.definition?.fields.内容2描述}</p></> : null}</section>

  </section>;
}

function GridBoard({ rows, columns, children }: { rows: number; columns: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setCell(Math.max(1, Math.floor(Math.min(element.clientWidth / columns, element.clientHeight / rows))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [rows, columns]);
  return <div ref={ref} className="gi-board-space"><div className="gi-board-size" style={{ width: cell * columns, height: cell * rows }}>{children}</div></div>;
}
