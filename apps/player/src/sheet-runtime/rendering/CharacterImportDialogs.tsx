import type { PendingCharacterConversion, PendingCharacterFormatSelection } from "../store/runtimeStore";

interface CharacterImportDialogsProps {
  pendingConversion: PendingCharacterConversion | null;
  pendingSelection: PendingCharacterFormatSelection | null;
  onSelect: (adapterId: string) => Promise<void>;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function CharacterImportDialogs({ pendingConversion, pendingSelection, onSelect, onConfirm, onCancel }: CharacterImportDialogsProps) {
  if (pendingSelection) {
    return (
      <div className="resource-manager-backdrop">
        <section className="resource-manager character-conversion-dialog" role="dialog" aria-modal="true" aria-label="选择人物卡格式">
          <header className="resource-manager-header"><div><p className="resource-manager-kicker">Character Format Adapter</p><h2>选择人物卡格式</h2></div></header>
          <div className="resource-manager-body">
            <p>多个 Adapter 与此文件匹配。框架不会自动猜测，请选择来源格式。</p>
            <div className="dialog-actions">
              {pendingSelection.adapters.map((adapter) => <button className="icon-button" type="button" key={adapter.ID} onClick={() => void onSelect(adapter.ID)}>{adapter.名称}</button>)}
              <button className="icon-button secondary-button" type="button" onClick={onCancel}>取消</button>
            </div>
          </div>
        </section>
      </div>
    );
  }
  if (!pendingConversion) return null;
  const { report } = pendingConversion;
  return (
    <div className="resource-manager-backdrop">
      <section className="resource-manager character-conversion-dialog" role="alertdialog" aria-modal="true" aria-label="确认有损人物卡转换">
        <header className="resource-manager-header"><div><p className="resource-manager-kicker">{pendingConversion.sourceName}</p><h2>确认人物卡转换</h2></div></header>
        <div className="resource-manager-body">
          <p>转换不会覆盖当前 Character Save；确认后会创建并选中一个新存档。</p>
          <div className="resource-manager-summary">
            <span>字段 {report.convertedFields} 已转换 / {report.skippedFields} 跳过</span>
            <span>Cards {report.matchedCards} 已匹配 / {report.skippedCards} 跳过</span>
            <span>图片 {report.convertedImages} 已转换 / {report.skippedImages} 跳过</span>
          </div>
          {report.diagnostics.length > 0 ? <ul>{report.diagnostics.map((issue, index) => <li key={`${issue.code}:${issue.path ?? index}`}><code>{issue.code}</code>：{issue.text}</li>)}</ul> : null}
          <div className="dialog-actions">
            <button className="icon-button" type="button" onClick={() => void onConfirm()}>确认并新建存档</button>
            <button className="icon-button secondary-button" type="button" onClick={onCancel}>取消</button>
          </div>
        </div>
      </section>
    </div>
  );
}
