import { readFileSync } from "node:fs";
import path from "node:path";

import { loadPbres, writePbres, type ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import { describe, expect, test } from "vitest";

import minotaurPackage from "../../contracts/conformance/resource-package/1.0.0-alpha.1/valid/minotaur-wrecker.json";
import armorPackage from "../../contracts/conformance/resource-package/1.0.0/valid/daggerheart-core-armor.json";
import { creatorWorkspaceDesign } from "../../apps/creator/src/workspace-prototype/design.generated.ts";
import { validateResourcePackageCandidate } from "../../apps/creator/src/workspace-prototype/resource-package-validator.ts";
import {
  addTemplateResource,
  adversaryData,
  armorData,
  clearAdversaryFeature,
  closeWorkspaceResourceTab,
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
  updateWeaponData,
  weaponData,
} from "../../apps/creator/src/workspace-prototype/workspace-model.ts";
import { armorTemplate, weaponTemplate } from "@pbdh/templates/core";

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

  test("moves and reorders mixed folders and resources with the imported Cards semantics", () => {
    const rootDocument = structuredClone(document);
    rootDocument.resources[0]!.path = "牛头人破坏者.json";
    let workspace = selectWorkspaceFolder(createWorkspace({ document: rootDocument, media }), null);
    workspace = createWorkspaceFolder(workspace, null, "场景");
    const folderId = workspace.folders.find((folder) => folder.name === "场景")!.id;
    const resourceId = workspace.document.resources[0]!.id;
    workspace = moveWorkspaceNode(workspace, { kind: "resource", id: resourceId }, null, 0);
    workspace = moveWorkspaceNode(workspace, { kind: "folder", id: folderId }, null, 0);

    expect(treeItemsInFolder(workspace, null).map((item) => `${item.kind}:${item.id}`)).toEqual([
      `folder:${folderId}`,
      `resource:${resourceId}`,
    ]);
    expect(workspace.document.resources[0]!.path).toBe("牛头人破坏者.json");
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
    expect(creatorSource).not.toContain("发送到桌面");
    expect(creatorSource).toContain("requestTabletopRename");
    expect(creatorSource).toContain('dialog.kind === "new-tabletop"');
    expect(surfaceSource).toContain("onPointerMove={moveDrag}");
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
