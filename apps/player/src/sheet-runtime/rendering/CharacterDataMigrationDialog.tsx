import type { PendingCharacterDataMigration } from "../store/runtimeStore";

export function CharacterDataMigrationDialog({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: PendingCharacterDataMigration;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <div className="character-save-dialog-backdrop">
      <section className="character-save-dialog" role="alertdialog" aria-modal="true" aria-label="确认人物数据升级">
        <h2>需要升级人物存档</h2>
        <p>“{pending.saveName}”使用人物数据版本 {pending.fromVersion}，当前系统需要 {pending.toVersion}。</p>
        <p>升级会依次执行 {pending.steps.length} 步。确认前不会改动原存档；取消后仍保留原版本。</p>
        <ol>{pending.steps.map((step) => <li key={`${step.fromVersion}:${step.toVersion}`}>{step.fromVersion} → {step.toVersion}</li>)}</ol>
        <footer>
          <button type="button" onClick={onCancel}>取消</button>
          <button className="primary" type="button" onClick={() => void onConfirm()}>确认升级</button>
        </footer>
      </section>
    </div>
  );
}
