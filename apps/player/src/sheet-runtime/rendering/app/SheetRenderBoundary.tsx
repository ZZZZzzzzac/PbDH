import { Component, type ReactNode } from "react";

interface SheetRenderBoundaryProps {
  children: ReactNode;
  packageName: string;
  recoverySystems: ReadonlyArray<{ id: string; name: string }>;
  onSwitchSystem(id: string): void;
}

export class SheetRenderBoundary extends Component<SheetRenderBoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <section className="player-sheet-render-error" role="alert" aria-label="人物卡显示失败">
      <h2>人物卡显示失败</h2>
      <p>“{this.props.packageName}”的显示发生异常。可以重试，或使用顶部工具栏切换系统包、切换存档、导出备份。</p>
      <p>无需清除浏览器缓存。本次恢复不会删除人物存档。</p>
      <div className="player-sheet-recovery-actions">
        <button type="button" onClick={() => this.setState({ error: null })}>重新尝试显示</button>
        <label>切换系统包
          <select aria-label="恢复用系统包" value="" onChange={(event) => this.props.onSwitchSystem(event.target.value)}>
            <option value="" disabled>选择其他系统包</option>
            {this.props.recoverySystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
          </select>
        </label>
      </div>
      <details><summary>错误详情</summary><pre>{this.state.error.message}</pre></details>
    </section>;
  }
}
