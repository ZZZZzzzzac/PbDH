// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import type { CharacterCreationGuide } from "../../apps/player/src/sheet-runtime/domain/characterCreationGuide.ts";
import { GuideSpotlight } from "../../apps/player/src/sheet-runtime/rendering/GuideSpotlight.tsx";

const packageRoot = "apps/player/public/system-packages/daggerheart-core";
const guide = JSON.parse(readFileSync(`${packageRoot}/guides/character-creation.json`, "utf8")) as CharacterCreationGuide;
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.unstubAllGlobals();
});

test.each([0, 1])("第 %i 个介绍步骤的操作栏独立于说明框", async (stepIndex) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  await act(async () => root.render(<GuideSpotlight guide={guide} session={{ stepIndex }} onPrevious={() => {}} onNext={() => {}} onFinish={() => {}} onExit={() => {}} />));
  const toolbar = document.querySelector('[role="toolbar"][aria-label="车卡指引操作"]');
  expect(toolbar).not.toBeNull();
  expect(toolbar?.closest('[role="dialog"]')).toBeNull();
  expect(toolbar?.querySelector('[aria-label="下一步"]')).not.toBeNull();
});

test.each(["layouts", "skins/skin-KimiK3", "skins/skin-black-hours"])("%s 中各步骤仅聚焦对应人物栏", (directory) => {
  const layout = document.createElement("div");
  layout.innerHTML = readFileSync(`${packageRoot}/${directory}/character-main.html`, "utf8");
  const cases = [
    ["choose-class", ["pick-class"], ["pick-subclass"]],
    ["hope-and-fear", ["hope"], ["hp", "stress", "armor-slots", "class-hope-feature"]],
    ["choose-weapons", ["pick-primary-weapon", "pick-secondary-weapon", "primary-weapon-name", "secondary-weapon-name"], ["pick-armor", "armor-name"]],
    ["choose-armor", ["pick-armor", "armor-name", "armor-description"], ["pick-primary-weapon", "pick-secondary-weapon"]],
  ] as const;
  for (const [id, included, excluded] of cases) {
    const target = guide.步骤.find((step) => step.ID === id)?.目标;
    const element = target?.类型 === "module"
      ? layout.querySelector(`pb-module[id="${target.模块ID}"]`)
      : target?.类型 === "region" ? layout.querySelector(`[data-guide-region-id="${target.区域ID}"]`) : null;
    expect(element, id).not.toBeNull();
    const modules = element?.matches("pb-module") ? [element.id] : [...element!.querySelectorAll("pb-module")].map((module) => module.id);
    for (const module of included) expect(modules, id).toContain(module);
    for (const module of excluded) expect(modules, id).not.toContain(module);
  }
});
