import type { PendingQuestionnaireResult } from "../store/runtimeStore";

export function QuestionnaireResultDialog({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: PendingQuestionnaireResult | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!pending) return null;
  return (
    <div className="validation-dialog-backdrop" data-output-exclude="true">
      <section className="validation-dialog" role="dialog" aria-modal="true" aria-label="确认问卷选择">
        <header className="validation-dialog-header">
          <div>
            <p className="eyebrow">问卷式车卡</p>
            <h2>确认应用“{pending.questionnaireName}”的结果</h2>
          </div>
          <div className="dialog-actions">
            <button className="icon-button" type="button" onClick={onConfirm} disabled={pending.selections.length === 0}>确认应用</button>
            <button className="icon-button secondary-button" type="button" onClick={onCancel}>取消</button>
          </div>
        </header>
        <div className="validation-dialog-body">
          <p>Base 将按以下顺序重放与手动选择相同的 Resource Picker 操作。确认前，当前 Character Save 不会改变。</p>
          {pending.selections.length > 0 ? (
            <ol className="questionnaire-selection-list">
              {pending.selections.map((selection, index) => (
                <li key={`${selection.sourceModuleId}:${selection.libraryId}:${index}`}>
                  <strong>{selection.pickerLabel}</strong>
                  <span>{selection.libraryName}：{selection.entries.map((entry) => entry.name).join("、")}</span>
                </li>
              ))}
            </ol>
          ) : <p className="questionnaire-empty-selection">当前没有可应用的选择。</p>}
          {pending.missingResources.length > 0 ? (
            <section className="questionnaire-missing-resources" role="alert">
              <h3>部分推荐资源当前不可用</h3>
              <p>这些选择不会写入人物卡。请安装包含对应 Stable Resource Entry 的 Resource Extension 后重新运行问卷。</p>
              <ul>
                {pending.missingResources.map((missing, index) => (
                  <li key={`${missing.sourceModuleId}:${missing.libraryId}:${missing.entryId}:${index}`}>
                    <strong>{missing.pickerLabel}</strong>
                    <span>{missing.libraryName}：{missing.entryId}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}
