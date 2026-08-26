import type { CharacterAdapterExport } from "../domain/characterFormatAdapter";

export interface PendingCharacterExport {
  conversion: CharacterAdapterExport;
  fileName: string;
}

export function CharacterExportDialog({ pending, onConfirm, onCancel }: { pending: PendingCharacterExport | null; onConfirm: () => void; onCancel: () => void }) {
  if (!pending) return null;
  const report = pending.conversion.report;
  return <div className="validation-dialog-backdrop" data-output-exclude="true">
    <section className="validation-dialog" role="alertdialog" aria-modal="true" aria-label="确认有损人物卡导出">
      <header className="validation-dialog-header"><h2>{pending.conversion.adapter.名称} 导出报告</h2></header>
      <div className="validation-dialog-body">
        <p>已导出 {report.exportedFields} 个字段、{report.exportedCards} 张 Card、{report.exportedImages} 张图片。</p>
        <p>将跳过 {report.skippedFields} 个字段、{report.skippedCards} 张 Card、{report.skippedImages} 张图片。</p>
        {report.diagnostics.length > 0 ? <ul>{report.diagnostics.map((item, index) => <li key={`${item.code}:${index}`}><code>{item.code}</code>：{item.text}</li>)}</ul> : null}
      </div>
      <div className="dialog-actions"><button className="icon-button" type="button" onClick={onConfirm}>仍然下载</button><button className="icon-button secondary-button" type="button" onClick={onCancel}>取消</button></div>
    </section>
  </div>;
}
