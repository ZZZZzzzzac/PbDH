// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TabletopContextMenu } from "../../packages/tabletop/src/react/index.tsx";

const cleanups: Array<() => Promise<void>> = [];
let width = 280;
let height = 240;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("innerWidth", 800);
  vi.stubGlobal("innerHeight", 600);
  width = 280;
  height = 240;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const element = this;
    return DOMRect.fromRect({
      width: Math.min(width, parseFloat(element.style.maxWidth) || width),
      height: Math.min(height, parseFloat(element.style.maxHeight) || height),
    });
  });
});

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mount(children: ReactNode) {
  const container = document.createElement("div");
  container.style.overflow = "hidden";
  container.style.transform = "translateX(10px)";
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  await act(async () => root.render(children));
  return { container, root, menu: document.querySelector<HTMLDivElement>("[role=menu]")! };
}

test.each([
  [100, 120, 100, 120],
  [790, 590, 510, 350],
  [790, 120, 510, 120],
  [100, 590, 100, 350],
  [0, 0, 8, 8],
  [1000, 900, 512, 352],
])("positions the measured menu at (%i, %i) within viewport margins", async (x, y, left, top) => {
  const { container, menu } = await mount(<TabletopContextMenu x={x} y={y} estimatedWidth={10} estimatedHeight={10} onClose={vi.fn()}><button>Action</button></TabletopContextMenu>);
  expect(menu.parentElement).toBe(document.body);
  expect(container.contains(menu)).toBe(false);
  expect(menu.style.position).toBe("fixed");
  expect(menu.style.left).toBe(`${left}px`);
  expect(menu.style.top).toBe(`${top}px`);
});

test("constrains oversized menus and lets their content scroll", async () => {
  width = 1000;
  height = 1200;
  const onClose = vi.fn();
  const { menu } = await mount(<TabletopContextMenu x={790} y={590} onClose={onClose}><button>Action</button></TabletopContextMenu>);
  expect(menu.style.left).toBe("8px");
  expect(menu.style.top).toBe("8px");
  expect(menu.style.maxWidth).toBe("784px");
  expect(menu.style.maxHeight).toBe("584px");
  expect(menu.style.overflowY).toBe("auto");
  expect(menu.style.gridAutoRows).toBe("max-content");
  expect(menu.style.alignContent).toBe("start");
  await act(async () => menu.dispatchEvent(new Event("scroll")));
  expect(onClose).not.toHaveBeenCalled();
});

test.each([800, 120])("preserves host minimum width within a %ipx viewport", async (viewportWidth) => {
  vi.stubGlobal("innerWidth", viewportWidth);
  const style = document.createElement("style");
  style.textContent = ".test-player-menu { min-width: 148px; }";
  document.head.append(style);
  cleanups.push(async () => style.remove());
  const { menu } = await mount(<TabletopContextMenu className="test-player-menu" x={100} y={100} onClose={vi.fn()}>Action</TabletopContextMenu>);
  expect(menu.style.minWidth).toBe(`${Math.min(148, viewportWidth - 16)}px`);
});

test("keeps actual height inside the viewport when the estimate is too short", async () => {
  height = 400;
  const { menu } = await mount(<TabletopContextMenu x={100} y={580} estimatedHeight={160} onClose={vi.fn()}>Tall menu</TabletopContextMenu>);
  expect(parseFloat(menu.style.top) + menu.getBoundingClientRect().height).toBeLessThanOrEqual(592);
  expect(menu.style.top).toBe("180px");
});

test.each(["scroll", "resize", "blur"])("closes on external %s and cleans up listeners", async (type) => {
  const onClose = vi.fn();
  const { container, root } = await mount(<TabletopContextMenu x={100} y={100} onClose={onClose}>Action</TabletopContextMenu>);
  await act(async () => (type === "scroll" ? container : window).dispatchEvent(new Event(type)));
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => root.render(null));
  window.dispatchEvent(new Event(type));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("retains outside-pointer and Escape dismissal with the latest callback", async () => {
  const firstClose = vi.fn();
  const onClose = vi.fn();
  const { menu, root } = await mount(<TabletopContextMenu x={100} y={100} onClose={firstClose}><button>Action</button></TabletopContextMenu>);
  await act(async () => root.render(<TabletopContextMenu x={100} y={100} onClose={onClose}><button>Action</button></TabletopContextMenu>));
  menu.querySelector("button")!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  expect(onClose).not.toHaveBeenCalled();
  document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(onClose).toHaveBeenCalledTimes(2);
  expect(firstClose).not.toHaveBeenCalled();
});

test("remeasures when menu content or the anchor changes", async () => {
  const onClose = vi.fn();
  const { menu, root } = await mount(<TabletopContextMenu x={790} y={590} onClose={onClose}>Short</TabletopContextMenu>);
  height = 400;
  await act(async () => root.render(<TabletopContextMenu x={780} y={580} onClose={onClose}>Longer</TabletopContextMenu>));
  expect(menu.style.left).toBe("500px");
  expect(menu.style.top).toBe("180px");
});
