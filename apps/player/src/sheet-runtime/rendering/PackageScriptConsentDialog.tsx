import type { PendingPackageScriptConsent } from "../store/runtimeStore";

export function PackageScriptConsentDialog({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: PendingPackageScriptConsent;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <div className="character-save-dialog-backdrop">
      <section className="character-save-dialog" role="alertdialog" aria-modal="true" aria-label="确认运行外部系统脚本">
        <h2>确认运行外部系统脚本</h2>
        <p>“{pending.packageName}”包含 {pending.scripts.length} 个脚本。这些脚本会在隔离环境中运行，但仍需你确认。</p>
        <p>此确认只适用于当前系统包版本和当前脚本内容；内容变化后会再次询问。</p>
        <ul>{pending.scripts.map((script) => <li key={`${script.path}:${script.label}`}><strong>{script.label}</strong><br /><code>{script.path}</code></li>)}</ul>
        <footer>
          <button type="button" onClick={onCancel}>取消</button>
          <button className="primary" type="button" onClick={() => void onConfirm()}>允许运行</button>
        </footer>
      </section>
    </div>
  );
}
