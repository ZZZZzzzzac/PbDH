import { useEffect, useRef, useState } from "react";
import { useAuth } from "@pbdh/platform-auth/provider";
import { OperationStatus } from "@pbdh/platform-ui";
import type { ExportResult } from "@pbdh/resource-conversion";

import { Icon } from "./Icons.tsx";
import { exportMarketPublication, marketExportTargets } from "./market-export.ts";
import type { Publication } from "./market-model.ts";

export function MarketExportDialog({ publication, onClose }: { publication: Publication; onClose: () => void }) {
  const auth = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const working = useRef(false);
  const [targetId, setTargetId] = useState(marketExportTargets[0]!.id);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  async function exportPackage() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const target = marketExportTargets.find((item) => item.id === targetId)!;
      const exported = await exportMarketPublication(publication, target, auth.credentials);
      setResult(exported);
      if (exported.ok) {
        const url = URL.createObjectURL(new Blob([new Uint8Array(exported.artifact.bytes)], { type: exported.artifact.mediaType }));
        try {
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = exported.artifact.fileName;
          anchor.click();
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "无法导出该资源包，请重试。");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  return <dialog ref={dialogRef} className="handoff-dialog market-export-dialog" aria-labelledby="market-export-title" aria-busy={busy} onCancel={(event) => { event.preventDefault(); if (!working.current) onClose(); }}>
    <header><h2 id="market-export-title">导出为第三方格式</h2><button type="button" aria-label="关闭" disabled={busy} onClick={onClose}><Icon name="x" /></button></header>
    <p>将「{publication.title}」的完整资源包导出为所选格式。不兼容的资源或字段会在转换结果中提示。</p>
    <label className="market-export-format">导出格式<select value={targetId} disabled={busy} onChange={(event) => { setTargetId(event.target.value); setResult(null); setError(null); }}>
      {marketExportTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
    </select></label>
    {busy && <OperationStatus label="正在取得资源包并转换…" />}
    {error && <p role="alert">{error}</p>}
    {result && <section className="market-export-report" aria-label="转换结果" aria-live="polite">
      <strong>{result.ok ? `已导出 ${result.report.converted} 项资源` : "导出失败"}</strong>
      {result.report.failed > 0 && <p>{result.report.failed} 项未能转换</p>}
      {result.ok && <p>{result.artifact.fileName}</p>}
      {result.report.diagnostics.length > 0 && <ul>{result.report.diagnostics.map((item, index) => <li key={index}>{item.resourceId && <span>{item.resourceId}： </span>}{item.message}</li>)}</ul>}
    </section>}
    <footer><button type="button" disabled={busy} onClick={onClose}>关闭</button><button type="button" className="primary-button" disabled={busy} onClick={() => void exportPackage()}>导出并下载</button></footer>
  </dialog>;
}
