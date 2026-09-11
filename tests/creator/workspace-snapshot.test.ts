import { expect, test } from "vitest";
import { createBlankWorkspace } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";
import { mergeWorkspaceSnapshot } from "../../apps/creator/src/workspace-prototype/workspace-snapshot.ts";

test("恢复快照保留新建和新编辑，不复活请求期间删除的工作区", async () => {
  const original = await createBlankWorkspace("原包");
  const removed = await createBlankWorkspace("已删除");
  const added = await createBlankWorkspace("新建");
  const edited = { ...original, dirty: true };
  const result = mergeWorkspaceSnapshot([edited, added], [original, removed], {
    baseline: [original, removed], replaceKeys: [original.key, removed.key],
  });
  expect(result).toEqual([edited, added]);
  expect(result[0]).toBe(edited);
});

test("显式删除仅影响未发生变化的目标，快照缺项不删除其他工作区", async () => {
  const target = await createBlankWorkspace("删除目标");
  const other = await createBlankWorkspace("其他工作区");
  const update = { baseline: [target, other], removeKeys: [target.key] };
  expect(mergeWorkspaceSnapshot([target, other], [], update)).toEqual([other]);
  const edited = { ...target, dirty: true };
  expect(mergeWorkspaceSnapshot([edited, other], [], update)).toEqual([edited, other]);
});

test("接纳未修改目标的新版和新云文档，不替换无关工作区", async () => {
  const target = await createBlankWorkspace("目标");
  const other = await createBlankWorkspace("其他");
  const remoteNew = await createBlankWorkspace("新云文档");
  const updated = { ...target, dirty: true };
  const result = mergeWorkspaceSnapshot([target, other], [updated, { ...other }, remoteNew], {
    baseline: [target, other], replaceKeys: [target.key],
  });
  expect(result).toEqual([updated, other, remoteNew]);
  expect(result[1]).toBe(other);
});
