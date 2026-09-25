// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import type { AnySchema } from "ajv";
import { templateRegistry } from "@pbdh/templates/core";
import { supportedTemplateFrontends } from "@pbdh/templates/frontend";
import { adversaryStatPresets, findAdversaryStatPreset } from "../../packages/templates/src/frontend/adversary/stat-presets.ts";

const frontends = supportedTemplateFrontends.filter((frontend) => frontend.templateId === "敌人");

test("40 组预设适配现有敌人契约，四处阈值已校正，社交弱于标准", () => {
  expect(Object.keys(adversaryStatPresets)).toHaveLength(10);
  for (const frontend of frontends) {
    const core = templateRegistry.resolve("敌人", frontend.templateVersion)!;
    const validate = new Ajv2020({ strict: true }).compile(core.schema as AnySchema);
    for (const [kind, tiers] of Object.entries(adversaryStatPresets)) {
      expect(Object.keys(tiers)).toEqual(["1", "2", "3", "4"]);
      for (const [tier, preset] of Object.entries(tiers)) {
        expect(Object.keys(preset)).toHaveLength(7);
        expect(validate({ ...core.defaultData, 种类: kind, 位阶: tier, ...preset })).toBe(true);
        if (kind === "杂兵") {
          expect(preset.重度伤害阈值).toBe("-");
          expect(preset.严重伤害阈值).toBe("-");
        } else expect(Number(preset.严重伤害阈值)).toBeGreaterThan(Number(preset.重度伤害阈值));
      }
    }
  }
  for (const kind of ["潜伏", "标准", "辅助"]) expect(findAdversaryStatPreset(kind, "1")!.严重伤害阈值).toBe("10");
  expect(findAdversaryStatPreset("辅助", "2")!.严重伤害阈值).toBe("18");
  const average = (damage: string) => {
    const [, count, sides, extra] = damage.match(/^(\d+)d(\d+)(?:\+(\d+))?$/)!;
    return Number(count) * (Number(sides) + 1) / 2 + Number(extra ?? 0);
  };
  for (const tier of ["1", "2", "3", "4"]) {
    const social = findAdversaryStatPreset("社交", tier)!;
    const standard = findAdversaryStatPreset("标准", tier)!;
    for (const field of ["难度", "攻击命中", "生命点", "重度伤害阈值", "严重伤害阈值"] as const) {
      expect(Number(social[field])).toBeLessThan(Number(standard[field]));
    }
    expect(social.压力点).toBe(standard.压力点);
    expect(average(social.攻击伤害)).toBeLessThan(average(standard.攻击伤害));
  }
});

test.each(frontends.map((frontend) => [frontend.templateVersion, frontend] as const))(
  "敌人 %s 按显式点击一次提交七项数值，其余创作内容保留",
  async (_version, frontend) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onValue = vi.fn();
    const onData = vi.fn();
    const data = {
      ...structuredClone(templateRegistry.resolve("敌人", frontend.templateVersion)!.defaultData),
      名称: "自定义敌人", 简介: "保留简介", 位阶: "2", 种类: "斗士", 难度: "99",
      攻击武器: "长枪", 攻击范围: "远距离", 攻击属性: "魔法",
      特性: [{ 特性名称: "自定义特性", 特性类型: "反应", 特性描述: "保留描述" }],
    };
    const before = structuredClone(data);
    const render = async (next: Record<string, unknown>) => act(async () => root.render(createElement(frontend.authoring.Editor, { data: next, onValue, onData })));
    const button = () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "使用模板")!;
    try {
      await render(data);
      expect(onData).not.toHaveBeenCalled();
      await act(async () => button().click());
      expect(onData).toHaveBeenCalledExactlyOnceWith({ ...data, ...findAdversaryStatPreset("斗士", "2") });
      expect(onValue).not.toHaveBeenCalled();
      expect(data).toEqual(before);
      expect(container.querySelector('[role="status"]')).toBeNull();

      await render({ ...data, 种类: "社交", 位阶: "4" });
      expect(onData).toHaveBeenCalledTimes(1);
      expect(container.querySelector('[role="status"]')).toBeNull();
      await act(async () => button().click());
      expect(onData).toHaveBeenLastCalledWith({ ...data, 种类: "社交", 位阶: "4", ...findAdversaryStatPreset("社交", "4") });

      for (const invalid of [{ 种类: "自定义种类", 位阶: "2" }, { 种类: "斗士", 位阶: "5" }, { 种类: "constructor", 位阶: "1" }, { 种类: "斗士", 位阶: "toString" }]) {
        await render({ ...data, ...invalid });
        expect(button().disabled).toBe(true);
        await act(async () => button().click());
      }
      expect(onData).toHaveBeenCalledTimes(2);
      await render(onData.mock.lastCall![0]);
      const difficulty = [...container.querySelectorAll("label")].find((label) => label.querySelector("span")?.textContent === "难度")!.querySelector("input")!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(difficulty, "23");
      await act(async () => difficulty.dispatchEvent(new Event("input", { bubbles: true })));
      expect(onValue).toHaveBeenLastCalledWith("难度", "23");
    } finally {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    }
  },
);
