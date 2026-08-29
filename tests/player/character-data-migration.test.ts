import { describe, expect, it, vi } from "vitest";
import { prepareCharacterDataMigration } from "../../apps/player/src/sheet-runtime/domain/characterDataMigration";

const migrations = [
  { fromVersion: "1.0.0", toVersion: "1.1.0", script: "migrations/1.0.0-1.1.0.js", scriptContent: "first" },
  { fromVersion: "1.1.0", toVersion: "2.0.0", script: "migrations/1.1.0-2.0.0.js", scriptContent: "second" },
];

describe("Character Data Migration", () => {
  it("逐步运行完整向前升级链，并保持原数据不变", async () => {
    const original = { profile: { name: "A" } };
    const execute = vi.fn(async (script: string, raw: unknown) => {
      const input = raw as { characterData: Record<string, unknown> };
      return { ...input.characterData, [script]: true };
    });
    const result = await prepareCharacterDataMigration({
      fromVersion: "1.0.0", toVersion: "2.0.0", characterData: original, migrations, execute,
    });
    expect(result).toEqual({ status: "ready", candidate: {
      fromVersion: "1.0.0", toVersion: "2.0.0",
      characterData: { profile: { name: "A" }, first: true, second: true },
      steps: migrations.map(({ fromVersion, toVersion, script }) => ({ fromVersion, toVersion, script })),
    } });
    expect(original).toEqual({ profile: { name: "A" } });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("缺步、分支、倒退和越过目标时拒绝执行", async () => {
    const common = { fromVersion: "1.0.0", toVersion: "2.0.0", characterData: {} };
    await expect(prepareCharacterDataMigration({ ...common, migrations: migrations.slice(1) })).resolves.toMatchObject({ status: "error" });
    await expect(prepareCharacterDataMigration({ ...common, migrations: [...migrations, { ...migrations[0], toVersion: "1.2.0" }] })).resolves.toMatchObject({ status: "error" });
    await expect(prepareCharacterDataMigration({ ...common, migrations: [{ ...migrations[0], fromVersion: "1.0.0", toVersion: "0.9.0" }] })).resolves.toMatchObject({ status: "error" });
    await expect(prepareCharacterDataMigration({ ...common, migrations: [{ ...migrations[0], toVersion: "3.0.0" }] })).resolves.toMatchObject({ status: "error" });
  });

  it("脚本异常、非 JSON 输出或逐步校验失败时不产生候选", async () => {
    const common = { fromVersion: "1.0.0", toVersion: "1.1.0", characterData: {}, migrations: migrations.slice(0, 1) };
    await expect(prepareCharacterDataMigration({ ...common, execute: async () => { throw new Error("boom"); } })).resolves.toMatchObject({ status: "error", message: expect.stringContaining("boom") });
    await expect(prepareCharacterDataMigration({ ...common, execute: async () => ({ bad: undefined }) })).resolves.toMatchObject({ status: "error" });
    await expect(prepareCharacterDataMigration({ ...common, execute: async () => ({}), validateStep: () => ["bad value"] })).resolves.toMatchObject({ status: "error", message: expect.stringContaining("bad value") });
  });

  it("相同版本无需升级，高版本存档不能降级", async () => {
    await expect(prepareCharacterDataMigration({ fromVersion: "1.0.0", toVersion: "1.0.0", characterData: {}, migrations: [] })).resolves.toEqual({ status: "current" });
    await expect(prepareCharacterDataMigration({ fromVersion: "2.0.0", toVersion: "1.0.0", characterData: {}, migrations: [] })).resolves.toMatchObject({ status: "error", message: expect.stringContaining("不能降级") });
  });
});
