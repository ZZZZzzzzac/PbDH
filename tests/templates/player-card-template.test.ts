import "fake-indexeddb/auto";
import Ajv2020 from "ajv/dist/2020.js";
import { expect, test } from "vitest";
import { DexieLocalDocumentStore, PbDHLocalDatabase } from "@pbdh/local-storage";
import { createTabletopDocument } from "@pbdh/tabletop/core";
import { loadTemplateCore, loadCurrentTemplateCore, templateUpgradeTargets } from "@pbdh/templates/core/lazy";
import { playerCardTemplate as template } from "../../packages/templates/src/core/player-card/1.0.0/capability.ts";
import { templateValidationMetadata } from "@pbdh/templates/core/validation";
import { getTemplateSortingFields } from "@pbdh/templates/core/explorer-sorting";
import { createBlankWorkspace, addTemplateResource, createWorkspace } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";
import { CreatorWorkspaceRepository } from "../../apps/creator/src/workspace-prototype/creator-workspace-repository.ts";
import { TabletopDocumentRepository } from "../../apps/creator/src/workspace-prototype/tabletop-document-repository.ts";
import { runCreatorPackageFileWorkflow } from "../../apps/creator/src/workspace-prototype/creator-package-file-workflow.ts";
import { executeGmTabletopCommand, placeWorkspaceResourcesOnTabletop } from "../../apps/creator/src/workspace-prototype/gm-tabletop-session.ts";

test("玩家卡初版使用独立身份、通用初值和非负整数实例状态", async () => {
  expect(await loadCurrentTemplateCore("玩家卡")).toBe(template);
  expect(await loadTemplateCore("玩家卡", "1.0.1")).toBeUndefined();
  expect(templateUpgradeTargets("玩家卡", "1.0.0")).toEqual([]);
  expect(template.state).toBe("published");
  expect(template.defaultData).toMatchObject({ 生命上限: "6", 压力上限: "6", 希望上限: "6", 护甲槽上限: "0" });
  const data = { ...template.defaultData, 名称: "艾琳", 玩家名: "阿青", 备注: "先侦察" };
  expect(template.project(data)).toEqual({ title: "艾琳", summary: "阿青 · 先侦察", searchText: "艾琳 玩家卡 阿青 6 6 6 0 先侦察" });
  expect(template.proposeResourceId({ ...data, 名称: "艾琳/侦察" })).toBe("艾琳-侦察");
  const validate = new Ajv2020({ strict: true }).compile(template.schema);
  expect(validate(data)).toBe(true);
  for (const value of ["-1", "1.5", "", "待定", "01"]) expect(validate({ ...data, 生命上限: value })).toBe(true);
  expect(validate({ ...data, 生命上限: 6 })).toBe(false);
  expect(validate({ ...data, characterSaveId: "not-linked" })).toBe(false);
  const state = template.tabletop.defaultState(data);
  expect(state).toEqual({ currentHp: "0", currentStress: "0", currentHope: "0", currentArmor: "0", notes: "先侦察" });
  const metadata = templateValidationMetadata(template.id, template.version)!;
  expect(metadata.tabletop.stateSchema).toEqual(template.tabletop.stateSchema);
  const validateState = new Ajv2020({ strict: true }).compile(metadata.tabletop.stateSchema);
  expect(validateState(state)).toBe(true);
  for (const field of ["currentHp", "currentStress", "currentHope", "currentArmor"]) {
    expect(validateState({ ...state, [field]: "-1" })).toBe(false);
    expect(validateState({ ...state, [field]: "0.5" })).toBe(false);
  }
  expect(getTemplateSortingFields(template.id, template.version).map((field) => field.key)).toEqual(["名称", "玩家名"]);
});

test("玩家卡贯通创建、保存、PBRES导入导出、GM实例操作和桌面恢复", async () => {
  const db = new PbDHLocalDatabase(`player-card-${crypto.randomUUID()}`);
  try {
    const store = new DexieLocalDocumentStore(db);
    const workspaces = new CreatorWorkspaceRepository(store);
    const created = addTemplateResource(await createBlankWorkspace("玩家追踪"), template);
    created.workspace.document.resources[0]!.data = { ...template.defaultData, 名称: "艾琳", 玩家名: "阿青", 备注: "初始备注", 护甲槽上限: "3" };
    await workspaces.save(created.workspace);
    const restored = (await workspaces.list())[0]!;
    const exported = await runCreatorPackageFileWorkflow({ type: "export-workspace", workspace: restored });
    expect(exported.type).toBe("workspace-export");
    if (exported.type !== "workspace-export") throw new Error(JSON.stringify(exported));
    const imported = await runCreatorPackageFileWorkflow({ type: "inspect-import", bytes: exported.bytes });
    expect(imported.type).toBe("import-ready");
    if (imported.type !== "import-ready") throw new Error(JSON.stringify(imported));
    const workspace = createWorkspace(imported.candidate);
    expect(workspace.document.resources[0]!.template).toEqual({ id: "玩家卡", version: "1.0.0" });
    expect(workspace.document.resources[0]!.data).toEqual(created.workspace.document.resources[0]!.data);
    const pick = { workspaceKey: workspace.key, resourceId: created.resourceId };
    const placed = placeWorkspaceResourcesOnTabletop(
      (id, version) => id === template.id && version === template.version ? template : undefined,
      createTabletopDocument(crypto.randomUUID(), "追踪桌面"), [workspace], [pick, pick],
    );
    if (!placed.ok) throw new Error(placed.error);
    let board = placed.tabletop;
    const first = board.instances[0]!;
    expect(first.state).toEqual({ currentHp: "0", currentStress: "0", currentHope: "0", currentArmor: "0", notes: "初始备注" });
    for (const commandId of ["adjust-hp", "adjust-stress", "adjust-hope", "adjust-armor", "set-notes"]) {
      const result = executeGmTabletopCommand(board, { type: "template-state", instanceId: first.id, commandId, value: commandId === "set-notes" ? "桌面私有备注" : "1" }, () => template.tabletop.commands);
      if (!result.ok) throw new Error(result.error);
      board = result.tabletop;
    }
    expect(board.instances[0]!.state).toEqual({ currentHp: "1", currentStress: "1", currentHope: "1", currentArmor: "1", notes: "桌面私有备注" });
    expect(board.instances[1]!.state).toEqual(first.state);
    expect(board.instances[0]!.resource).not.toBe(board.instances[1]!.resource);
    const edited = executeGmTabletopCommand(board, { type: "edit-instance-data", instanceId: first.id, path: ["生命上限"], value: "8" });
    if (!edited.ok) throw new Error(edited.error);
    board = edited.tabletop;
    expect(board.instances[0]!.resource.data.生命上限).toBe("8");
    expect(board.instances[1]!.resource.data.生命上限).toBe("6");
    expect(workspace.document.resources[0]!.data).toMatchObject({ 生命上限: "6" });
    expect(workspace.document.resources[0]!.data).toMatchObject({ 备注: "初始备注" });
    const boards = new TabletopDocumentRepository(store);
    await boards.save(board, new Map());
    expect((await boards.list())[0]!.model.instances).toEqual(board.instances);
    expect((await workspaces.list())[0]!.document.resources[0]!.data).toMatchObject({ 备注: "初始备注" });
  } finally { db.close(); await db.delete(); }
});
