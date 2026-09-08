// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { buildCardPrintSvg, buildReadonlyHtmlSnapshot, extractEmbeddedCharacterJson, prepareCardImagesForPrint } from "../../apps/player/src/sheet-runtime/export/output.ts";
import type { CharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";

const character: CharacterData = {
  kind: "pbdh-character-data", schemaVersion: "0.1.0",
  systemPackage: { id: "test", version: "1.0.0" },
  character: { id: "test-character", values: { name: "哈罗</script>" } },
  cards: { instances: [] }, compositeResources: {}, embeddedResourceEntries: {},
  playerImages: {}, updatedAt: "2026-09-08T00:00:00Z",
};

afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("独立人物 HTML", () => {
  it("打印复用相同卡面的编码和 URL，内容变化后重新生成，退出后清理", async () => {
    vi.stubGlobal("crypto", webcrypto);
    vi.spyOn(HTMLImageElement.prototype, "decode").mockResolvedValue(undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: "",
    } as unknown as CanvasRenderingContext2D);
    const encode = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["image"], { type: "image/jpeg" })));
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:print-cache-test");
    const revokeUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const hosts = [0, 1].map(() => {
      const card = document.createElement("article");
      card.className = "play-card";
      card.innerHTML = '<div data-pbdh-card-display><div data-pbdh-canonical-surface></div></div>';
      document.body.append(card);
      const host = card.querySelector<HTMLElement>("[data-pbdh-canonical-surface]")!;
      Object.defineProperties(host, { offsetWidth: { value: 63 }, offsetHeight: { value: 88 } });
      host.attachShadow({ mode: "open" }).innerHTML = "<p>打印缓存测试卡</p>";
      return host;
    });
    const dispose = await prepareCardImagesForPrint(document.body);
    expect(encode).toHaveBeenCalledTimes(1);
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll("[data-print-card-ready]")).toHaveLength(2);
    dispose();
    expect(revokeUrl).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll(".player-card-print-image, [data-print-card-ready]")).toHaveLength(0);
    hosts[0].shadowRoot!.innerHTML = "<p>更新后的打印缓存测试卡</p>";
    const disposeAgain = await prepareCardImagesForPrint(document.body);
    expect(encode).toHaveBeenCalledTimes(2);
    disposeAgain();
  });

  it("从当前卡面生成自包含打印 SVG，保留文字适配与卡图", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    Object.defineProperties(host, { offsetWidth: { value: 63 }, offsetHeight: { value: 88 } });
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = '<style>:host { color: black; } article { transform:scale(.175); }</style><article><h1 style="font-size:23px">临终遗言</h1><img src="blob:card"></article>';
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/webp" } })));
    const result = await buildCardPrintSvg(host);
    expect(result.width).toBe(63);
    expect(result.height).toBe(88);
    expect(result.svg).toContain('viewBox="0 0 63 88"');
    expect(result.svg).toContain('xmlns="http://www.w3.org/1999/xhtml"');
    expect(result.svg).toContain('font-size:23px');
    expect(result.svg).toContain('src="data:image/webp;base64,AQID"');
    expect(result.svg).not.toContain("blob:card");
    expect(result.svg).not.toContain(":host");
    expect(shadow.querySelector("img")!.src).toBe("blob:card");
  });

  it("保留隔离卡面的样式、文字、嵌套 Shadow DOM 和内联图片", async () => {
    const root = document.createElement("main");
    root.innerHTML = '<div data-pbdh-canonical-surface></div>';
    document.body.append(root);
    const shadow = root.firstElementChild!.attachShadow({ mode: "open" });
    shadow.innerHTML = '<style>:host { color: red; }</style><h1>巨型捕食者</h1><img src="blob:test-image"><div id="nested"></div>';
    shadow.querySelector("#nested")!.attachShadow({ mode: "open" }).innerHTML = '<p>凶猛撕咬</p>';
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/webp" } })));

    const html = await buildReadonlyHtmlSnapshot(character, root);
    expect(html.match(/shadowrootmode="open"/g)).toHaveLength(2);
    expect(html).toContain(":host { color: red; }");
    expect(html).toContain("巨型捕食者");
    expect(html).toContain("凶猛撕咬");
    expect(html).toContain('src="data:image/webp;base64,AQID"');
    expect(html).not.toContain("blob:test-image");
    expect(shadow.querySelector("img")!.src).toBe("blob:test-image");
  });

  it("保存当前输入值并保留安全嵌入的角色数据", async () => {
    const root = document.createElement("main");
    root.innerHTML = '<textarea>旧值</textarea><input type="checkbox"><button>删除</button>';
    document.body.append(root);
    root.querySelector("textarea")!.value = "当前经历";
    root.querySelector("input")!.checked = true;
    const html = await buildReadonlyHtmlSnapshot(character, root, "哈罗");
    expect(html).toContain('readonly="">当前经历</textarea>');
    expect(html).toContain('checked=""');
    expect(html).not.toContain("<button>");
    const embedded = extractEmbeddedCharacterJson(html);
    expect(embedded.ok).toBe(true);
    if (embedded.ok) expect(JSON.parse(embedded.text).character.values.name).toBe("哈罗</script>");
  });

  it("卡图失效时明确报错，不生成白板快照", async () => {
    const root = document.createElement("main");
    root.innerHTML = '<div></div>';
    root.firstElementChild!.attachShadow({ mode: "open" }).innerHTML = '<img src="blob:expired">';
    document.body.append(root);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("图片已失效")));
    await expect(buildReadonlyHtmlSnapshot(character, root)).rejects.toThrow("图片已失效");
  });
});
