import { readFileSync } from "node:fs";
import path from "node:path";

import { loadPbres, writePbres, type ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import { describe, expect, test } from "vitest";

import minotaurPackage from "../../contracts/conformance/resource-package/1.0.0-alpha.1/valid/minotaur-wrecker.json";
import { creatorWorkspaceDesign } from "../../apps/creator/src/workspace-prototype/design.generated.ts";
import { validateResourcePackageCandidate } from "../../apps/creator/src/workspace-prototype/resource-package-validator.ts";
import {
  addTemplateResource,
  adversaryData,
  clearAdversaryFeature,
  createBlankWorkspace,
  createWorkspace,
  deleteAdversaryFeature,
  forkCurrentWorkspace,
  planImport,
  prepareWorkspaceExport,
  removePortrait,
  updateAdversaryData,
  updateResourcePresentation,
  updateWeaponData,
  weaponData,
} from "../../apps/creator/src/workspace-prototype/workspace-model.ts";
import { weaponTemplate } from "@pbdh/templates/core";

const root = process.cwd();
const document = minotaurPackage as ResourcePackageLogicalDocument;
const asset = document.assets[0]!;
const media = new Map([[asset.id, new Uint8Array(readFileSync(path.join(
  root,
  "contracts/conformance/resource-package/1.0.0-alpha.1/media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp",
)))]]);

describe("Creator Workspace prototype state model", () => {
  test("covers empty list to explicit new Workspace with a valid formal Contract", async () => {
    const workspace = await createBlankWorkspace("本地敌人包");
    expect(workspace.document.package.name).toBe("本地敌人包");
    expect(workspace.document.resources).toHaveLength(1);
    expect(workspace.document.resources[0]?.media).toEqual({});
    expect(await validateResourcePackageCandidate(workspace.document, workspace.media)).toEqual([]);
  });

  test("editing marks the Workspace dirty and preserves the canonical resource shape", () => {
    const workspace = createWorkspace({ document, media });
    const edited = updateAdversaryData(workspace, (data) => { data.名称 = "伤痕牛头人"; });
    expect(edited.dirty).toBe(true);
    expect(adversaryData(edited).名称).toBe("伤痕牛头人");
    expect(adversaryData(workspace).名称).toBe("牛头人破坏者");
  });

  test("creates a blank weapon from the registered Template and edits every authoring field", () => {
    const source = createWorkspace({ document, media });
    const created = addTemplateResource(source, weaponTemplate.id, weaponTemplate.version);
    expect(created.workspace.document.resources).toHaveLength(2);
    expect(created.workspace.document.resources.map((resource) => resource.template.id)).toEqual(["敌人", "武器"]);
    expect(weaponData(created.workspace, created.resourceId)).toEqual(weaponTemplate.defaultData);

    const values = {
      名称: "测试长刃",
      类型: "主武器",
      位阶: "2",
      属性: "力量",
      距离: "近战",
      伤害: "d10+3",
      伤害类型: "物理",
      负荷: "双手",
      描述: "命中后将目标推开。",
    };
    const edited = updateWeaponData(created.workspace, (data) => Object.assign(data, values), created.resourceId);
    expect(weaponData(edited, created.resourceId)).toEqual(values);
    expect(adversaryData(edited).名称).toBe("牛头人破坏者");
    expect(edited.dirty).toBe(true);
  });

  test("clears or deletes a feature without mutating the source Workspace", () => {
    const workspace = createWorkspace({ document, media });
    const cleared = clearAdversaryFeature(workspace, 1);
    expect(adversaryData(cleared).特性[1]).toEqual({ 名称: "", 原名: "", 类型: "", 特性描述: "" });
    expect(adversaryData(workspace).特性[1]?.名称).toBe("蛮牛冲撞");

    const deleted = deleteAdversaryFeature(workspace, 1);
    expect(adversaryData(deleted).特性.map((feature) => feature.名称)).toEqual(["蓄力", "角撞"]);
    expect(adversaryData(deleted)).not.toBe(adversaryData(workspace));
  });

  test("stores card mode and fixed-ratio policy in the Resource presentation Contract", () => {
    const workspace = createWorkspace({ document, media });
    const edited = updateResourcePresentation(workspace, (presentation) => {
      presentation.mode = "text";
      presentation.fixedRatio = false;
    });
    expect(edited.dirty).toBe(true);
    expect(edited.document.resources[0]?.presentation).toMatchObject({
      mode: "text",
      fixedRatio: false,
    });
    expect(workspace.document.resources[0]?.presentation).toMatchObject({
      mode: "split",
      fixedRatio: true,
    });
  });

  test("removing portrait produces a text-only resource and drops its unused package media", () => {
    const textOnly = removePortrait(createWorkspace({ document, media }));
    expect(textOnly.document.resources[0]?.media).toEqual({});
    expect(textOnly.document.assets).toEqual([]);
    expect(textOnly.media.has(asset.id)).toBe(false);
    expect(adversaryData(textOnly).名称).toBe("牛头人破坏者");
  });

  test("plans insert, no-op, safe update and dirty conflict explicitly", () => {
    const current = createWorkspace({ document, media });
    const same = { document: structuredClone(document), media };
    expect(planImport(undefined, same)).toBe("insert");
    expect(planImport(current, same)).toBe("no-op");
    expect(planImport({ ...current, dirty: true }, same)).toBe("conflict");

    const changed = structuredClone(document);
    changed.snapshotDigest = `sha256:${"1".repeat(64)}`;
    expect(planImport(current, { document: changed, media })).toBe("update");
    expect(planImport({ ...current, dirty: true }, { document: changed, media })).toBe("conflict");
  });

  test("conflict save-as receives a new Package ID and reset version", async () => {
    const fork = await forkCurrentWorkspace(updateAdversaryData(
      createWorkspace({ document, media }),
      (data) => { data.简介 = "本地修改"; },
    ));
    expect(fork.document.package.id).not.toBe(document.package.id);
    expect(fork.document.package.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    expect(fork.document.package.version).toBe("1.0.0");
    expect(fork.dirty).toBe(false);
    expect(await validateResourcePackageCandidate(fork.document, fork.media)).toEqual([]);
  });

  test("exports and reloads an edited complete .pbres through the formal archive boundary", async () => {
    const edited = updateAdversaryData(createWorkspace({ document, media }), (data) => {
      data.名称 = "可导出的牛头人";
    });
    const exported = await prepareWorkspaceExport(edited);
    expect(await validateResourcePackageCandidate(exported.document, exported.media)).toEqual([]);
    const loaded = await loadPbres(writePbres(exported.document, exported.media), validateResourcePackageCandidate);
    expect(loaded.diagnostics).toEqual([]);
    expect(loaded.candidate?.document).toEqual(exported.document);
    expect((loaded.candidate?.document.resources[0]?.data as { 名称: string }).名称).toBe("可导出的牛头人");
  });

  test("round-trips a mixed adversary and weapon package without changing package exchange semantics", async () => {
    const created = addTemplateResource(
      createWorkspace({ document, media }),
      weaponTemplate.id,
      weaponTemplate.version,
    );
    const edited = updateWeaponData(created.workspace, (data) => {
      data.名称 = "巡林短剑";
      data.伤害 = "d8+2";
    }, created.resourceId);
    const exported = await prepareWorkspaceExport(edited);
    expect(exported.document.license).toEqual(document.license);
    expect(await validateResourcePackageCandidate(exported.document, exported.media)).toEqual([]);

    const loaded = await loadPbres(writePbres(exported.document, exported.media), validateResourcePackageCandidate);
    expect(loaded.diagnostics).toEqual([]);
    expect(new Set(loaded.candidate?.document.resources.map((resource) => resource.template.id))).toEqual(new Set(["敌人", "武器"]));
    const loadedWeapon = loaded.candidate?.document.resources.find((resource) => resource.template.id === "武器");
    expect((loadedWeapon?.data as { 名称: string }).名称).toBe("巡林短剑");
    expect(planImport(createWorkspace(exported), loaded.candidate!)).toBe("no-op");
  });

  test("binds the App shell to the reviewed OpenPencil source", () => {
    expect(creatorWorkspaceDesign).toMatchObject({
      document: "docs/design/creator-app.op",
      page: "10 Creator Workspace Rough",
      frame: "#30 / Creator Workspace / 敌人编辑",
      canonicalSurface: "enemy-card-r1 / Canonical",
      appBar: { height: 56, background: "#1B1714" },
      tabs: { height: 36 },
      columns: { resourceNavigationWidth: 250, bodyGap: 12, bodyPadding: 12 },
      field: { height: 32, fontSize: 12 },
      weapon: {
        page: "12 Creator Weapon Editing",
        frame: "#37 / Creator Workspace / 主武器编辑",
        canonicalSurface: "weapon-card-r1 / Canonical",
      },
    });
  });
});
