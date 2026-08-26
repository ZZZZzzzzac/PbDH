import type { CSSProperties } from "react";
import type { SystemPackage } from "../../domain/systemPackage";

export function PackageLoadingSurface({
  progress,
  presentation,
}: {
  progress: { completed: number; total: number } | null;
  presentation: NonNullable<SystemPackage["manifest"]["加载展示"]> | null;
}) {
  const accentColor = presentation?.强调色 ?? "#7c3aed";
  const message = presentation?.标语 ?? "正在装配人物卡世界……";
  const completed = progress ? Math.min(progress.completed, progress.total) : 0;
  const percent = progress && progress.total > 0 ? Math.round((completed / progress.total) * 100) : null;
  const style = { "--package-loading-accent": accentColor } as CSSProperties;

  return (
    <section className="package-loading-surface" role="status" aria-live="polite" aria-label="System Package 加载中" style={style}>
      <div className="package-loading-panel">
        <span className="package-loading-mark" aria-hidden="true">PbDH</span>
        <p className="package-loading-message">{message}</p>
        <progress
          className="package-loading-progress"
          {...(progress && progress.total > 0 ? { max: progress.total, value: completed } : {})}
        />
        <p className="package-loading-detail">
          {percent === null ? "正在读取 System Package" : `正在读取 System Package · ${percent}%`}
        </p>
      </div>
    </section>
  );
}
