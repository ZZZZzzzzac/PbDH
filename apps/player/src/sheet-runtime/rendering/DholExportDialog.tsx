import { randomUUID } from "@pbdh/crypto-runtime";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CharacterData } from "../domain/characterData";
import { exportExternalCharacterData, type CharacterAdapterExport } from "../domain/characterFormatAdapter";
import type { SystemPackage } from "../domain/systemPackage";
import { buildDholDelivery, DHOL_ADAPTER_ID, normalizeDholRoomCode, sendDholDelivery } from "../export/dholDelivery";
import "../styles/dhol-export.css";

const roomCodeStorageKey = "pbdh:player:dhol:last-room-code";

export function DholExportDialog({ data, systemPackage, onClose }: { data: CharacterData; systemPackage: SystemPackage; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const retryRef = useRef<string | null>(null);
  const sendingRef = useRef(false);
  const [prepared, setPrepared] = useState<{ delivery: ReturnType<typeof buildDholDelivery>; report: CharacterAdapterExport["report"] } | null>(null);
  const [roomCode, setRoomCode] = useState(() => {
    try { return localStorage.getItem(roomCodeStorageKey) ?? ""; } catch { return ""; }
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const code = normalizeDholRoomCode(roomCode);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    let active = true;
    setPrepared(null);
    setError(null);
    void (async () => {
      try {
        const adapter = systemPackage.characterFormatAdapters?.find((item) => item.ID === DHOL_ADAPTER_ID);
        if (!adapter) throw new Error("当前系统包缺少 dhsheet 导出适配器。");
        const converted = await exportExternalCharacterData(data, adapter, systemPackage);
        if ("error" in converted) throw new Error(converted.error.text);
        const fatal = converted.report.diagnostics.find((item) => item.level === "error");
        if (fatal) throw new Error(fatal.text);
        const delivery = buildDholDelivery(data, converted.document, systemPackage);
        if (active) setPrepared({ delivery, report: converted.report });
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "角色格式转换失败。");
      }
    })();
    return () => { active = false; };
  }, [data, systemPackage]);

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sendingRef.current || code.length !== 6 || !prepared) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      retryRef.current ??= randomUUID();
      const sent = await sendDholDelivery(code, retryRef.current, prepared.delivery);
      try { localStorage.setItem(roomCodeStorageKey, code); } catch { /* 房间码记忆失败不影响投递。 */ }
      setResult(`${sent.action === "created" ? "已新增" : "已覆盖"}：${sent.name}`);
      retryRef.current = null;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "角色投递失败。");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return <dialog
    ref={dialogRef}
    className="dhol-export-dialog"
    data-output-exclude="true"
    aria-labelledby="dhol-export-title"
    onCancel={(event) => { event.preventDefault(); if (!sending) onClose(); }}
  >
    <form onSubmit={(event) => void send(event)}>
      <header className="dhol-export-dialog__header">
        <h2 id="dhol-export-title">发送到 DHOL 在线面板</h2>
        <p>当前角色：{String(data.character.values["character-name"] || "（未命名角色）")}</p>
      </header>
      <div className="dhol-export-dialog__body">
        <label htmlFor="dhol-room-code">房间码</label>
        <input
          id="dhol-room-code"
          value={roomCode}
          onChange={(event) => { setRoomCode(normalizeDholRoomCode(event.target.value).slice(0, 6)); retryRef.current = null; if (prepared) setError(null); setResult(null); }}
          maxLength={6}
          placeholder="例如 ABC123"
          autoComplete="off"
          autoFocus
          disabled={sending}
        />
        <p className="dhol-export-dialog__hint">同名角色再次发送会覆盖在线面板中的整张角色卡及资源状态。头像不会发送。</p>
        {!prepared && !error ? <p role="status">正在准备角色数据…</p> : null}
        {prepared && (prepared.report.diagnostics.length > 0 || prepared.report.skippedFields + prepared.report.skippedCards + prepared.report.skippedImages > 0) ? <details className="dhol-export-dialog__report" open>
          <summary>dhsheet 转换报告</summary>
          <p>适配器跳过 {prepared.report.skippedFields} 个字段、{prepared.report.skippedCards} 张卡牌、{prepared.report.skippedImages} 张图片。投递会额外保留原始文字并补充未映射卡牌；DHOL 的显示可能不完全一致。</p>
          <ul>{prepared.report.diagnostics.map((item, index) => <li key={`${item.code}:${index}`}>{item.text}</li>)}</ul>
        </details> : null}
        {error && <p className="dhol-export-dialog__error" role="alert">{error}</p>}
        {result && <p className="dhol-export-dialog__success" role="status">{result}</p>}
      </div>
      <footer className="dhol-export-dialog__actions">
        <a
          className="icon-button secondary-button dhol-export-dialog__open-panel"
          href={code.length === 6 ? `https://screenol.pages.dev/?room=${encodeURIComponent(code)}` : "https://screenol.pages.dev/"}
          target="_blank"
          rel="noopener noreferrer"
          title={code.length === 6 ? `在新标签页打开 DHOL 房间 ${code}` : "在新标签页打开 DHOL 在线面板"}
        >{code.length === 6 ? "打开此房间 ↗" : "打开 DHOL ↗"}</a>
        <button type="button" className="icon-button secondary-button" onClick={onClose} disabled={sending}>关闭</button>
        <button type="submit" className="icon-button" disabled={sending || code.length !== 6 || !prepared}>{sending ? "发送中…" : "发送"}</button>
      </footer>
    </form>
  </dialog>;
}
