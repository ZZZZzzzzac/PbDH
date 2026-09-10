import type { ValidationIssue } from "../../domain/validationRunner";

export function ValidationIssueDialog({
  issues,
  open,
  onClose,
  onContinue,
}: {
  issues: ValidationIssue[];
  open: boolean;
  onClose: () => void;
  onContinue?: () => void;
}) {
  if (!open) return null;

  return (
    <div className="validation-dialog-backdrop" data-output-exclude="true">
      <section className="validation-dialog" role="dialog" aria-modal="true" aria-label="Validation Report">
        <header className="validation-dialog-header">
          <h2>检查报告</h2>
          <div className="dialog-actions">
            {onContinue ? (
              <button className="icon-button" type="button" onClick={onContinue} aria-label="继续输出">
                <span>继续</span>
              </button>
            ) : null}
            <button className="icon-button secondary-button" type="button" onClick={onClose} aria-label={onContinue ? "取消输出" : "关闭检查报告"}>
              <span>{onContinue ? "取消" : "关闭"}</span>
            </button>
          </div>
        </header>
        <div className="validation-dialog-body">
          <p>审核仅供参考；有条件、临时或无法确定的效果请与主持人核对。</p>
          {issues.length === 0 ? (
            <p className="validation-empty">未发现问题。</p>
          ) : (
            <ul>
              {issues.map((issue, index) => (
                <li className={`validation-issue validation-${issue.level}`} key={`${issue.source}-${issue.code ?? issue.text}-${index}`}>
                  <span className="validation-severity">{{ error: "错误", warning: "待核对", info: "提示" }[issue.level]}</span>
                  <p>{issue.text}</p>
                  <details className="validation-source"><summary>检查详情</summary>
                    {issue.code && <code>{issue.code}</code>}
                    {issue.path && <div>{issue.path}</div>}
                    <div>{issue.source}</div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
