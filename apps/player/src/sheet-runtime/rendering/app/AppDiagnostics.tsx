import type { PackageIssue } from "../../domain/systemPackage";
import type { ValidationIssue } from "../../domain/validationRunner";

export function PackageIssuePanel({ issues }: { issues: PackageIssue[] }) {
  const blocking = issues.some((issue) => issue.level === "fatal" || issue.level === "error");
  return (
    <section className="error-panel" role={blocking ? "alert" : "status"} aria-label={blocking ? "System Package error" : "System Package warnings"}>
      <h2>{blocking ? "System Package 错误" : "System Package 警告"}</h2>
      <ul>
        {issues.map((issue) => (
          <li key={`${issue.code}-${issue.path ?? issue.text}`}>
            <strong>{issue.code}</strong>
            {issue.location?.file ? ` ${issue.location.file}` : ""}
            {issue.path ? ` ${issue.path}: ` : " "}
            {issue.text}
            {(issue.entities?.length || issue.evidence?.length) ? (
              <details>
                <summary>诊断上下文</summary>
                <pre>{JSON.stringify({ location: issue.location, entities: issue.entities, evidence: issue.evidence }, null, 2)}</pre>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

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
          {issues.length === 0 ? (
            <p className="validation-empty">未发现问题。</p>
          ) : (
            <ul>
              {issues.map((issue, index) => (
                <li className={`validation-issue validation-${issue.level}`} key={`${issue.source}-${issue.code ?? issue.text}-${index}`}>
                  <strong>{issue.level}</strong>
                  {issue.code ? ` ${issue.code}` : ""} {issue.path ? `${issue.path}: ` : ""}
                  {issue.text}
                  <span className="validation-source">{issue.source}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
