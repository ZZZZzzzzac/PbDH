import { readFileSync } from "node:fs";
import path from "node:path";

import { loadPbres, writePbres, type ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import { describe, expect, test } from "vitest";

import minotaurPackage from "../../contracts/conformance/resource-package/1.0.0-alpha.1/valid/minotaur-wrecker.json";
import stableMinotaurPackage from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import armorPackage from "../../contracts/conformance/resource-package/1.0.0/valid/daggerheart-core-armor.json";
import { creatorWorkspaceDesign } from "../../apps/creator/src/workspace-prototype/design.generated.ts";
import { validateResourcePackageCandidate } from "../../apps/creator/src/workspace-prototype/resource-package-validator.ts";
import {
  addTemplateResource,
  adversaryData,
  armorData,
  clearAdversaryFeature,
  closeWorkspaceResourceTab,
  copyWorkspaceResourceToPackage,
  createBlankWorkspace,
  createWorkspaceFolder,
  createWorkspace,
  deleteWorkspaceNode,
  deleteAdversaryFeature,
  duplicateWorkspaceResource,
  forkCurrentWorkspace,
  planImport,
  pinWorkspaceResource,
  prepareWorkspaceExport,
  previewWorkspaceResource,
  removePortrait,
  renameWorkspaceFolder,
  moveWorkspaceNode,
  selectWorkspaceFolder,
  toggleWorkspaceFolder,
  treeItemsInFolder,
  updateAdversaryData,
  updateArmorData,
  updateResourcePresentation,
  updateResourceReplacement,
  updateWorkspaceResourceData,
  updateWeaponData,
  weaponData,
} from "../../apps/creator/src/workspace-prototype/workspace-model.ts";
import {
  adversaryTemplate, ancestryTemplate, armorTemplate, communityTemplate, domainTemplate, environmentTemplate, itemTemplate, professionTemplate, subclassTemplate, weaponTemplate,
} from "@pbdh/templates/core";

const root = process.cwd();
const document = minotaurPackage as ResourcePackageLogicalDocument;
const asset = document.assets[0]!;
const media = new Map([[asset.id, new Uint8Array(readFileSync(path.join(
  root,
  "contracts/conformance/resource-package/1.0.0-alpha.1/media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp",
)))]]);

describe("Creator Workspace prototype state model", () => {
  test("creates an empty Workspace draft and requires a resource before Contract export", async () => {
    const workspace = await createBlankWorkspace("本地敌人包");
    expect(workspace.document.package.name).toBe("本地敌人包");
    expect(workspace.document.resources).toEqual([]);
    expect(workspace.openResourceIds).toEqual([]);
    expect(await validateResourcePackageCandidate(workspace.document, workspace.media)).toContainEqual(
      expect.objectContaining({ severity: "error", location: "/resources" }),
    );
  });

  test("editing marks the Workspace dirty and preserves the canonical resource shape", () => {
    const workspace = createWorkspace({ document, media });
    const edited = updateAdversaryData(workspace, (data) => { data.名称 = "伤痕牛头人"; });
    expect(edited.dirty).toBe(true);
    expect(adversaryData(edited).名称).toBe("伤痕牛头人");
    expect(adversaryData(workspace).名称).toBe("牛头人破坏者");
    expect(edited.dirtyResourceIds).toEqual([workspace.document.resources[0]!.id]);
  });

  test("stores only the chosen replacement target on the source resource", () => {
    const workspace = createWorkspace({
      document: structuredClone(stableMinotaurPackage) as ResourcePackageLogicalDocument,
      media,
    });
    const added = addTemplateResource(workspace, adversaryTemplate.id, adversaryTemplate.version);
    const targetId = workspace.document.resources[0]!.id;
    const linked = updateResourceReplacement(
      added.workspace,
      added.resourceId,
      "alternate-form",
      targetId,
    );
    expect(linked.document.resources.find((resource) => resource.id === added.resourceId)?.replacements)
      .toEqual([{ replacementId: "alternate-form", targetResourceId: targetId }]);
    expect(linked.document).not.toHaveProperty("materializedForms");
  });

  test("opening and pinning resources does not create a modification marker", () => {
    const workspace = createWorkspace({ document, media });
    const resourceId = workspace.document.resources[0]!.id;
    const opened = previewWorkspaceResource(workspace, resourceId);
    const pinned = pinWorkspaceResource(opened, resourceId);

    expect(pinned.dirty).toBe(false);
    expect(pinned.dirtyResourceIds).toEqual([]);
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

  test("creates and edits a complete armor resource without changing another resource", () => {
    const source = createWorkspace({ document, media });
    const created = addTemplateResource(source, armorTemplate.id, armorTemplate.version);
    expect(armorData(created.workspace, created.resourceId)).toEqual(armorTemplate.defaultData);

    const values = {
      名称: "测试护甲",
      类型: "护甲",
      护甲值: "4",
      重度伤害阈值: "7",
      严重伤害阈值: "14",
      描述: "坚韧：降低伤害。",
      风味描述: "由铁木编成。",
      位阶: "2",
    };
    const edited = updateArmorData(created.workspace, (data) => Object.assign(data, values), created.resourceId);
    expect(armorData(edited, created.resourceId)).toEqual(values);
    expect(adversaryData(edited).名称).toBe("牛头人破坏者");
    expect(edited.dirtyResourceIds).toContain(created.resourceId);
  });

  test.each([environmentTemplate, ancestryTemplate, communityTemplate, professionTemplate, subclassTemplate, itemTemplate, domainTemplate])(
    "creates and generically edits stable %s resources",
    (template) => {
      const source = createWorkspace({ document, media });
      const created = addTemplateResource(source, template.id, template.version);
      const edited = updateWorkspaceResourceData(created.workspace, (data) => { data.名称 = `测试${template.id}`; }, created.resourceId);
      const resource = edited.document.resources.find((candidate) => candidate.id === created.resourceId)!;
      expect(resource.template).toEqual({ id: template.id, version: "1.0.0" });
      expect(resource.data).toMatchObject({ 名称: `测试${template.id}` });
      expect(edited.dirtyResourceIds).toContain(created.resourceId);
      expect(adversaryData(edited).名称).toBe("牛头人破坏者");
    },
  );

  test("exports and reloads a stable environment through the formal .pbres boundary", async () => {
    const source = createWorkspace({ document, media });
    const created = addTemplateResource(source, environmentTemplate.id, environmentTemplate.version);
    const edited = updateWorkspaceResourceData(created.workspace, (data) => {
      Object.assign(data, {
        名称: "荒废林地",
        原文: "ABANDONED GROVE",
        难度: "11",
        特性: [{ 名称: "蔓生战场", 原名: "Overgrown Battlefield", 类型: "被动", 描述: "旧战场遗迹。", 引导问题: "为何发生冲突？" }],
      });
    }, created.resourceId);

    const exported = await prepareWorkspaceExport(edited);
    expect(await validateResourcePackageCandidate(exported.document, exported.media)).toEqual([]);
    const loaded = await loadPbres(writePbres(exported.document, exported.media), validateResourcePackageCandidate);
    expect(loaded.diagnostics).toEqual([]);
    expect(loaded.candidate?.document.resources.find((resource) => resource.id === created.resourceId)).toMatchObject({
      template: { id: "环境", version: "1.0.0" },
      data: { 名称: "荒废林地", 原文: "ABANDONED GROVE", 难度: "11" },
    });
  });

  test("stores resources in user folders rather than grouping them by Template", () => {
    const source = selectWorkspaceFolder(createWorkspace({ document, media }), null);
    const folderWorkspace = createWorkspaceFolder(source, null, "第一幕");
    const folderId = folderWorkspace.folders.find((folder) => folder.name === "第一幕")!.id;
    const selected = selectWorkspaceFolder(folderWorkspace, folderId);
    const created = addTemplateResource(selected, weaponTemplate.id, weaponTemplate.version);

    expect(created.workspace.resourceLocations.find((item) => item.resourceId === created.resourceId)).toMatchObject({ parentId: folderId });
    expect(created.workspace.document.resources.find((item) => item.id === created.resourceId)?.path).toBe("第一幕/resource-2.json");
    expect(created.workspace.folders.some((folder) => folder.name === "武器")).toBe(false);
  });

  test("moves resources across folders while keeping a deterministic folder-first order", () => {
    const rootDocument = structuredClone(document);
    rootDocument.resources[0]!.path = "牛头人破坏者.json";
    let workspace = selectWorkspaceFolder(createWorkspace({ document: rootDocument, media }), null);
    workspace = createWorkspaceFolder(workspace, null, "场景");
    const folderId = workspace.folders.find((folder) => folder.name === "场景")!.id;
    const resourceId = workspace.document.resources[0]!.id;
    workspace = moveWorkspaceNode(workspace, { kind: "resource", id: resourceId }, folderId);
    expect(workspace.document.resources[0]!.path).toBe("场景/牛头人破坏者.json");
    workspace = moveWorkspaceNode(workspace, { kind: "resource", id: resourceId }, null);

    expect(treeItemsInFolder(workspace, null).map((item) => `${item.kind}:${item.id}`)).toEqual([
      `folder:${folderId}`,
      `resource:${resourceId}`,
    ]);
    expect(workspace.document.resources[0]!.path).toBe("牛头人破坏者.json");
  });

  test("ignores resource array and legacy order values when sorting a folder", () => {
    const sortedDocument = structuredClone(document);
    const first = sortedDocument.resources[0]!;
    first.id = "z-resource";
    first.path = "z-10.json";
    sortedDocument.resources.push({ ...structuredClone(first), id: "a-resource", path: "a-2.json" });
    const legacyWorkspace = createWorkspace({ document: sortedDocument, media });
    legacyWorkspace.folders = [];
    legacyWorkspace.resourceLocations = [
      { resourceId: "z-resource", parentId: null, order: 0 },
      { resourceId: "a-resource", parentId: null, order: 99 },
    ];
    const restored = createWorkspace(legacyWorkspace);

    expect(treeItemsInFolder(restored, null).map((item) => item.id)).toEqual(["a-resource", "z-resource"]);
    expect(restored.resourceLocations.map((item) => [item.resourceId, item.order])).toEqual([
      ["z-resource", 1],
      ["a-resource", 0],
    ]);
  });

  test("treats a same-folder drag as a no-op instead of persisting manual order", () => {
    const workspace = createWorkspace({ document, media });
    const resourceId = workspace.document.resources[0]!.id;
    const parentId = workspace.resourceLocations.find((item) => item.resourceId === resourceId)!.parentId;

    expect(moveWorkspaceNode(workspace, { kind: "resource", id: resourceId }, parentId)).toBe(workspace);
    expect(workspace.dirty).toBe(false);
  });

  test("toggles folders and deletes resources while closing their tabs", () => {
    let workspace = selectWorkspaceFolder(createWorkspace({ document, media }), null);
    workspace = createWorkspaceFolder(workspace, null, "临时");
    const folderId = workspace.folders.find((folder) => folder.name === "临时")!.id;
    workspace = toggleWorkspaceFolder(workspace, folderId);
    expect(workspace.folders.find((folder) => folder.id === folderId)?.collapsed).toBe(true);

    const resourceId = workspace.document.resources[0]!.id;
    workspace = deleteWorkspaceNode(workspace, { kind: "resource", id: resourceId });
    expect(workspace.document.resources).toHaveLength(0);
    expect(workspace.openResourceIds).not.toContain(resourceId);
  });

  test("renames folders and updates descendant resource paths", () => {
    let workspace = createWorkspaceFolder(createWorkspace({ document, media }), null, "旧名称");
    const folderId = workspace.currentFolderId!;
    workspace = selectWorkspaceFolder(workspace, folderId);
    const created = addTemplateResource(workspace, weaponTemplate.id, weaponTemplate.version);
    workspace = renameWorkspaceFolder(created.workspace, folderId, "新名称");

    expect(workspace.document.resources.find((item) => item.id === created.resourceId)?.path).toBe("新名称/resource-2.json");
  });

  test("uses temporary tabs, pins them, and chooses an adjacent tab when closing", () => {
    const source = createWorkspace({ document, media });
    const created = addTemplateResource(source, weaponTemplate.id, weaponTemplate.version);
    const firstId = source.document.resources[0]!.id;
    const secondId = created.resourceId;
    let workspace = closeWorkspaceResourceTab(created.workspace, firstId).workspace;
    workspace = previewWorkspaceResource(workspace, firstId);
    expect(workspace.previewResourceId).toBe(firstId);
    workspace = pinWorkspaceResource(workspace, firstId);
    expect(workspace.previewResourceId).toBeNull();

    const closed = closeWorkspaceResourceTab(workspace, firstId);
    expect(closed.workspace.openResourceIds).not.toContain(firstId);
    expect(closed.nextResourceId).toBe(secondId);
  });

  test("duplicates a resource beside its source with an independent ID and path", () => {
    const workspace = createWorkspace({ document, media });
    const source = workspace.document.resources[0]!;
    const duplicated = duplicateWorkspaceResource(workspace, source.id);
    const copy = duplicated.workspace.document.resources.find((resource) => resource.id === duplicated.resourceId)!;

    expect(copy.id).not.toBe(source.id);
    expect(copy.path).not.toBe(source.path);
    expect(copy.data).toEqual(source.data);
    expect(duplicated.workspace.dirtyResourceIds).toContain(copy.id);
    expect(duplicated.workspace.openResourceIds).toContain(copy.id);
  });

  test("copies a resource, its media, and linked forms into another package", async () => {
    let source = createWorkspace({
      document: structuredClone(stableMinotaurPackage) as ResourcePackageLogicalDocument,
      media,
    });
    const sourceId = source.document.resources[0]!.id;
    const linked = addTemplateResource(source, adversaryTemplate.id, adversaryTemplate.version);
    source = updateResourceReplacement(linked.workspace, sourceId, "alternate-form", linked.resourceId);
    const target = await createBlankWorkspace("组合资源包");

    const copied = copyWorkspaceResourceToPackage(source, target, sourceId);
    const copiedSource = copied.workspace.document.resources.find((resource) => resource.id === copied.resourceId)!;
    const copiedTargetId = copiedSource.replacements?.[0]?.targetResourceId;

    expect(copied.copiedResourceIds).toHaveLength(2);
    expect(copiedSource.id).not.toBe(sourceId);
    expect(copiedTargetId).not.toBe(linked.resourceId);
    expect(copied.workspace.document.resources.some((resource) => resource.id === copiedTargetId)).toBe(true);
    expect(copied.workspace.document.assets).toEqual(source.document.assets);
    expect(copied.workspace.media.get(asset.id)).toEqual(source.media.get(asset.id));
    expect(copied.workspace.media.get(asset.id)).not.toBe(source.media.get(asset.id));
    expect(copied.workspace.openResourceIds).toContain(copied.resourceId);
  });

  test("replaces a temporary tab in place and selects the resource folder", () => {
    let workspace = createWorkspace({ document, media });
    const second = addTemplateResource(workspace, weaponTemplate.id, weaponTemplate.version);
    workspace = closeWorkspaceResourceTab(second.workspace, second.resourceId).workspace;
    workspace = createWorkspaceFolder(workspace, null, "第二幕");
    const folderId = workspace.currentFolderId!;
    const third = addTemplateResource(workspace, weaponTemplate.id, weaponTemplate.version);
    workspace = closeWorkspaceResourceTab(third.workspace, third.resourceId).workspace;

    workspace = previewWorkspaceResource(workspace, second.resourceId);
    const previewIndex = workspace.openResourceIds.indexOf(second.resourceId);
    workspace = previewWorkspaceResource(workspace, third.resourceId);

    expect(workspace.openResourceIds.indexOf(third.resourceId)).toBe(previewIndex);
    expect(workspace.openResourceIds).not.toContain(second.resourceId);
    expect(workspace.currentFolderId).toBe(folderId);
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

  test("an explicit Publication fork records the exact source while a local copy does not invent one", async () => {
    const source = createWorkspace({ document, media });
    const publicationFork = await forkCurrentWorkspace(source, {
      publicationId: "01989f4e-7b2c-7000-8000-000000000071",
      packageId: document.package.id,
      version: document.package.version,
      snapshotDigest: document.snapshotDigest,
    });
    const localCopy = await forkCurrentWorkspace(publicationFork);

    expect(localCopy.document.forkSource).toBeNull();
    expect(publicationFork.document.forkSource).toEqual({
      publicationId: "01989f4e-7b2c-7000-8000-000000000071",
      packageId: document.package.id,
      version: document.package.version,
      snapshotDigest: document.snapshotDigest,
      copiedResources: document.resources.map((resource) => ({
        packageId: document.package.id,
        resourceId: resource.id,
      })),
    });
    expect(publicationFork.document.package.id).not.toBe(document.package.id);
    expect(await validateResourcePackageCandidate(publicationFork.document, publicationFork.media)).toEqual([]);
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

  test("exports and reloads an edited armor through the complete .pbres boundary", async () => {
    const armorWorkspace = createWorkspace({
      document: armorPackage as ResourcePackageLogicalDocument,
      media: new Map(),
    });
    const edited = updateArmorData(armorWorkspace, (data) => {
      data.名称 = "改良填充布甲";
      data.护甲值 = "4";
      data.风味描述 = "工坊重新缝制了内衬。";
    });
    const exported = await prepareWorkspaceExport(edited);
    expect(await validateResourcePackageCandidate(exported.document, exported.media)).toEqual([]);

    const loaded = await loadPbres(writePbres(exported.document, exported.media), validateResourcePackageCandidate);
    expect(loaded.diagnostics).toEqual([]);
    expect(loaded.candidate?.document.package.id).toBe(armorPackage.package.id);
    expect(loaded.candidate?.document.resources[0]).toMatchObject({
      id: armorPackage.resources[0]!.id,
      path: armorPackage.resources[0]!.path,
      template: { id: "护甲", version: "1.0.0" },
      data: { 名称: "改良填充布甲", 护甲值: "4", 风味描述: "工坊重新缝制了内衬。" },
    });
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
      gmTabletop: {
        page: "13 GM Tabletop",
        frame: "#32 / GM Tabletop / 敌人桌面",
        instanceEditorFrame: "#32 / GM Tabletop / 敌人实例编辑",
        resourceNavigationWidth: 250,
        tabs: { height: 36 },
        zoomStatus: { width: 72, height: 28 },
        canvas: { background: "#D8D1C7", selectedBorder: "#A8403D" },
        menus: { canvasWidth: 230, instanceWidth: 180 },
        instanceEditor: { editorWidth: 560, previewBackground: "#D8D1C7" },
      },
    });
  });

  test("prints GM cards without application chrome or selection controls", () => {
    const styles = readFileSync(path.join(
      root,
      "apps/creator/src/workspace-prototype/workspace.css",
    ), "utf8");
    expect(styles).toContain("@media print");
    expect(styles).toContain(".tabletop-tabs, .instance-editor-toolbar");
    expect(styles).toContain(".tabletop-zoom-status");
    expect(styles).toContain(".context-menu");
    expect(styles).toContain(".tabletop-instance.is-selected { outline: 0; }");
    expect(styles).toContain("transform: none !important");
  });

  test("keeps the armor editor inside the mobile viewport without widening other editors", () => {
    const creatorSource = readFileSync(path.join(
      root,
      "apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx",
    ), "utf8");
    const styles = readFileSync(path.join(
      root,
      "apps/creator/src/workspace-prototype/workspace.css",
    ), "utf8");

    expect(creatorSource).toContain('armor ? " armor-workbench-body" : ""');
    expect(styles).toContain(".armor-workbench-body { grid-template-columns: minmax(0, 1fr); }");
    expect(styles).toContain(".armor-workbench-body .armor-field-grid { min-width: 0; }");
  });

  test("binds GM whiteboard gestures and context menus without tool modes", () => {
    const creatorSource = readFileSync(path.join(
      root,
      "apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx",
    ), "utf8");
    const surfaceSource = readFileSync(path.join(
      root,
      "packages/tabletop/src/react/index.tsx",
    ), "utf8");

    expect(creatorSource).not.toContain("tabletop-toolbar");
    expect(creatorSource).not.toContain("tabletopTool");
    expect(creatorSource).toContain("event.button !== 1 && event.button !== 2");
    expect(creatorSource).toContain("if (!event.ctrlKey) return");
    expect(creatorSource).toContain("application/x-pbdh-resource");
    expect(creatorSource).toContain("放到当前桌面");
    expect(creatorSource).toContain('className="package-license"');
    expect(creatorSource).not.toContain("发送到桌面");
    expect(creatorSource).toContain("requestTabletopRename");
    expect(creatorSource).toContain("prepareWorkspaceReplacement");
    expect(creatorSource).toContain("切换形态");
    expect(creatorSource).toContain("selectedInstanceIds={selectedInstanceIds}");
    expect(creatorSource).toContain('type: "edit-instance-data"');
    expect(creatorSource).not.toContain('type: "replace-instance-resource"');
    expect(creatorSource).toContain('dialog.kind === "new-tabletop"');
    expect(creatorSource).toContain('aria-label="导入桌面"');
    expect(creatorSource).toContain('aria-label="桌面回收站"');
    expect(creatorSource).toContain("duplicateTabletop");
    expect(creatorSource).toContain('dialog.kind === "tabletop-import-conflict"');
    expect(creatorSource).toContain("保留两份");
    expect(surfaceSource).toContain("onPointerMove={moveDrag}");
    expect(surfaceSource).toContain('event.ctrlKey || event.metaKey ? "toggle"');
    expect(surfaceSource).toContain('type: "move-many"');
    expect(surfaceSource).toContain("ArrowRight");
    expect(surfaceSource).toContain("onInstanceContextMenu");
    expect(surfaceSource).toContain("onDragStart={(event) => event.preventDefault()}");
  });

  test("keeps every tabletop tab open until deletion and imports Market packages into an empty workspace", () => {
    const creatorSource = readFileSync(path.join(
      root,
      "apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx",
    ), "utf8");

    expect(creatorSource).not.toContain("openTabletopIds");
    expect(creatorSource).not.toContain("handoff-tabletop");
    expect(creatorSource).toContain(
      "creatorWorkspaceRepository.save(next, auth.credentials?.accountId ?? null, true)",
    );
  });

  test("opens the shared cloud recycle bin from the account dialog and renders its empty state", () => {
    const creatorSource = readFileSync(path.join(
      root,
      "apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx",
    ), "utf8");
    const platformUiSource = readFileSync(path.join(
      root,
      "packages/platform-ui/src/index.tsx",
    ), "utf8");

    expect(creatorSource).toContain('usePlatformAccountManagement("creator", "云端回收站", openCloudTrash)');
    expect(creatorSource).toContain('usePlatformAccountManagement("gm", "云端回收站", openCloudTrash)');
    expect(creatorSource).toContain("<strong>回收站为空</strong>");
    expect(creatorSource).toContain("仅保存在此浏览器，不等于云备份");
    expect(creatorSource).toContain("cloudDocumentService.deleteFromTrash(remote, credentials)");
    expect(creatorSource).toContain("永久删除");
    expect(creatorSource).not.toContain('role="menuitem" onClick={() => void openCloudTrash()}>云端回收站');
    expect(platformUiSource).toContain("accountManageLabel={accountManagement?.accountManageLabel}");
    expect(platformUiSource).toContain("onAccountManage={accountManagement?.onAccountManage}");
    expect(platformUiSource).toContain("AppBarRegistration[]");
  });

  test("routes Market handoff through the Platform Shell", () => {
    const marketSource = readFileSync(path.join(root, "apps/market/src/MarketApp.tsx"), "utf8");
    const platformSource = readFileSync(path.join(root, "apps/platform/src/PlatformApp.tsx"), "utf8");

    expect(marketSource).not.toContain("window.open");
    expect(marketSource).toContain("onHandoffNavigate(handoff.target, url)");
    expect(platformSource).toContain("onHandoffNavigate={navigateHandoff}");
  });
});
