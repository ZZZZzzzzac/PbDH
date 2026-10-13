// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { DholExportDialog } from "../../apps/player/src/sheet-runtime/rendering/DholExportDialog.tsx";
import { exportExternalCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterFormatAdapter.ts";
import { createEmptyCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import type { SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import { DHOL_PACKAGE_ID } from "../../apps/player/src/sheet-runtime/export/dholDelivery.ts";

vi.mock("../../apps/player/src/sheet-runtime/domain/characterFormatAdapter.ts", () => ({ exportExternalCharacterData: vi.fn() }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

test("发送前展示转换报告，失败重试使用相同幂等键与角色快照", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
  vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function (this: HTMLDialogElement) { this.open = false; });
  const system: SystemPackage = { manifest: { ID: DHOL_PACKAGE_ID, 名称: "匕首之心", 版本: "1.0.2", 角色数据版本: "1.0.0" }, pages: [], modules: [], characterFormatAdapters: [{ ID: "dhsheet-character", 名称: "dhsheet", 导出文件后缀: ".json" }] };
  const data = createEmptyCharacterData(system);
  data.character.values["character-name"] = "测试角色";
  vi.mocked(exportExternalCharacterData).mockResolvedValue({
    adapter: system.characterFormatAdapters![0]!,
    document: { ruleSetId: "daggerheart", name: "测试角色", hope: 3, hp: [false], hpMax: 1, stress: [false], stressMax: 1, armorBoxes: [false], armorMax: 0, cards: [] },
    report: { exportedFields: 10, skippedFields: 1, exportedCards: 0, skippedCards: 0, exportedImages: 0, skippedImages: 0, diagnostics: [{ level: "warning", code: "LOSS", text: "物品栏仅显示前五行" }] },
  });
  const request = vi.fn().mockRejectedValueOnce(new TypeError("Network failure"))
    .mockResolvedValue(Response.json({ ok: true, action: "updated", name: "测试角色", generation: 2, seq: 3 }));
  vi.stubGlobal("fetch", request);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<DholExportDialog data={data} systemPackage={system} onClose={() => {}} />));
    expect(container.textContent).toContain("物品栏仅显示前五行");
    expect(request).not.toHaveBeenCalled();
    const input = container.querySelector("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "abc123");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const submit = () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await act(async () => { submit(); });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("重试");
    await act(async () => { submit(); });
    expect(container.querySelector('[role="status"]')?.textContent).toBe("已覆盖：测试角色");
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]![1].headers["Idempotency-Key"]).toBe(request.mock.calls[1]![1].headers["Idempotency-Key"]);
    expect(request.mock.calls[0]![1].body).toBe(request.mock.calls[1]![1].body);
    expect(localStorage.getItem("pbdh:player:dhol:last-room-code")).toBe("ABC123");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
