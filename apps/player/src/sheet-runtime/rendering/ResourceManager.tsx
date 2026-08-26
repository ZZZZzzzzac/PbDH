import { Download, Upload, X } from "lucide-react";
import { useEffect, useRef, type ChangeEvent } from "react";
import type { EffectiveResourceCatalog } from "../domain/effectiveResourceCatalog";
import type { ResourceExtensionIssue } from "../domain/resourceExtension";
import { getOtherResourceLibraries, getResourcePickerLinks, type SystemPackage } from "../domain/systemPackage";
import type { PendingResourceExtensionConversion, PendingResourceExtensionRemoval, PendingResourceExtensionReplacement, PendingResourceFormatSelection, ResourceExtensionImportState } from "../store/runtimeStore";

interface ResourceManagerProps {
  catalog: EffectiveResourceCatalog;
  systemPackage: SystemPackage;
  assetUrls: Record<string, string>;
  importState: ResourceExtensionImportState | null;
  pendingReplacement: PendingResourceExtensionReplacement | null;
  pendingConversion: PendingResourceExtensionConversion | null;
  pendingSelection: PendingResourceFormatSelection | null;
  pendingRemoval: PendingResourceExtensionRemoval | null;
  referenceIssues: ResourceExtensionIssue[];
  onUpload: (file: File) => Promise<void>;
  onConfirmReplacement: () => Promise<void>;
  onCancelReplacement: () => void;
  onRequestRemoval: (extensionId: string) => void;
  onConfirmRemoval: () => Promise<void>;
  onCancelRemoval: () => void;
  onSelectFormat: (adapterId: string) => Promise<void>;
  onConfirmConversion: () => Promise<void>;
  onCancelConversion: () => void;
  onClose: () => void;
}

export function ResourceManager({ catalog, systemPackage, assetUrls, importState, pendingReplacement, pendingConversion, pendingSelection, pendingRemoval, referenceIssues, onUpload, onConfirmReplacement, onCancelReplacement, onRequestRemoval, onConfirmRemoval, onCancelRemoval, onSelectFormat, onConfirmConversion, onCancelConversion, onClose }: ResourceManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await onUpload(file);
    event.target.value = "";
  };

  return (
    <div className="resource-manager-backdrop">
      <section className="resource-manager" role="dialog" aria-modal="true" aria-label="Resource Manager">
        <header className="resource-manager-header">
          <div>
            <p className="resource-manager-kicker">Current System Package</p>
            <h2>资源管理器</h2>
          </div>
          <div className="dialog-actions">
            <button className="icon-button" type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload aria-hidden="true" size={16} />
              <span>上传 Extension</span>
            </button>
            <button ref={closeButtonRef} className="icon-button secondary-button" type="button" onClick={onClose} aria-label="关闭资源管理器">
              <X aria-hidden="true" size={16} />
              <span>关闭</span>
            </button>
          </div>
          <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json,application/zip,.json,.zip,.dhcb" onChange={(event) => void handleFile(event)} aria-label="上传 Resource Extension" />
        </header>

        {importState ? <ImportResult state={importState} /> : null}
        {pendingSelection ? <FormatSelection pending={pendingSelection} onSelect={onSelectFormat} onCancel={onCancelConversion} /> : null}
        {pendingConversion ? <ConversionConfirmation pending={pendingConversion} onConfirm={onConfirmConversion} onCancel={onCancelConversion} /> : null}
        {pendingReplacement ? <ReplacementConfirmation pending={pendingReplacement} onConfirm={onConfirmReplacement} onCancel={onCancelReplacement} /> : null}
        {pendingRemoval ? <RemovalConfirmation pending={pendingRemoval} onConfirm={onConfirmRemoval} onCancel={onCancelRemoval} /> : null}

        <div className="resource-manager-body">
          <div className="resource-manager-summary">
            <span>{catalog.libraries.length} 个有效资源库</span>
            <span>{catalog.extensions.filter((item) => item.status === "active").length} 个已启用 Extension</span>
          </div>
          {catalog.libraries.length === 0 ? <p className="resource-manager-empty">当前系统包没有 Resource Library。</p> : (
            <div className="resource-manager-library-list">
              {catalog.libraries.map(({ library, contributors }) => (
                <article className="resource-manager-library" key={library.ID}>
                  <div className="resource-manager-library-heading">
                    <div>
                      <h3>{library.名称}</h3>
                      <code>{library.ID}</code>
                    </div>
                    <div className="resource-manager-library-status"><span>有效</span><strong>{library.entries.length}<small> Entries</small></strong></div>
                  </div>
                  <p className="resource-manager-picker-links">入口：{linkedPickerNames(systemPackage, library.ID).join("、") || "未链接"}</p>
                  <ul className="resource-manager-contributors">
                    {contributors.map((contributor) => (
                      <li key={`${contributor.source.type}:${contributor.source.id}`}>
                        <span className={`resource-source-badge source-${contributor.source.type}`}>{contributor.source.type === "systemPackage" ? "System Package" : "Extension"}</span>
                        <span>{contributor.source.name}</span>
                        <code>{contributor.source.id}</code>
                        <span>v{contributor.source.version}</span>
                        <strong>{contributor.entryCount}</strong>
                        {contributor.source.type === "resourceExtension" ? (
                          <>
                            <span>{countExtensionImages(assetUrls, contributor.source.id)} 图</span>
                            <button className="resource-manager-text-action" type="button" onClick={() => onRequestRemoval(contributor.source.id)}>卸载</button>
                          </>
                        ) : <><span>—</span><span /></>}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
          {catalog.extensions.some((item) => item.status === "disabled") ? (
            <section className="resource-manager-disabled" aria-label="已禁用 Resource Extensions">
              <h3>已禁用 Extension</h3>
              {catalog.extensions.filter((item) => item.status === "disabled").map((item) => (
                <div key={item.extension.ID}><strong>{item.extension.名称}</strong> <code>{item.extension.ID}</code> <button className="resource-manager-text-action" type="button" onClick={() => onRequestRemoval(item.extension.ID)}>卸载</button><ul>{item.issues.map((issue) => <li key={`${issue.code}:${issue.path}`}>{issue.code}：{issue.text}</li>)}</ul></div>
              ))}
            </section>
          ) : null}
          {referenceIssues.length > 0 ? <section className="resource-manager-disabled" aria-label="失效资源引用"><h3>失效资源引用</h3><ul>{referenceIssues.map((issue) => <li key={`${issue.code}:${issue.path}`}>{issue.code}：{issue.text}</li>)}</ul></section> : null}
        </div>
      </section>
    </div>
  );
}

function FormatSelection({ pending, onSelect, onCancel }: { pending: PendingResourceFormatSelection; onSelect: (id: string) => Promise<void>; onCancel: () => void }) {
  return <section className="resource-manager-confirm" role="alertdialog" aria-label="选择资源格式">
    <div><strong>多个格式适配器匹配</strong><span>请选择本次导入使用的格式；选择前不会写入资源目录。</span></div>
    <div className="dialog-actions">{pending.adapters.map((adapter) => <button className="icon-button" type="button" key={adapter.ID} onClick={() => void onSelect(adapter.ID)}>{adapter.名称}</button>)}<button className="icon-button secondary-button" type="button" onClick={onCancel}>取消</button></div>
  </section>;
}

function ConversionConfirmation({ pending, onConfirm, onCancel }: { pending: PendingResourceExtensionConversion; onConfirm: () => Promise<void>; onCancel: () => void }) {
  const conversion = pending.loaded.conversion!;
  const counts = conversion.counts;
  return <section className="resource-manager-confirm" role="alertdialog" aria-label="确认外部资源转换">
    <div><strong>确认转换并安装 {conversion.adapterName}？</strong>
      <span>来源 {counts.sourceEntries} · 已转换 {counts.convertedEntries} · 跳过 {counts.skippedEntries}</span>
      <span>字段 {counts.convertedFields} 已转换 / {counts.skippedFields} 跳过 · 图片 {counts.boundImages} 绑定 / {counts.orphanImages} 孤立</span>
      {pending.loaded.issues.length > 0 ? <ul>{pending.loaded.issues.map((issue, index) => <li key={`${issue.code}:${issue.path ?? index}`}><code>{issue.code}</code>：{issue.text}</li>)}</ul> : null}
    </div>
    <div className="dialog-actions"><button className="icon-button" type="button" onClick={() => void onConfirm()}>确认安装</button><button className="icon-button secondary-button" type="button" onClick={onCancel}>取消</button></div>
  </section>;
}

function ReplacementConfirmation({ pending, onConfirm, onCancel }: { pending: PendingResourceExtensionReplacement; onConfirm: () => Promise<void>; onCancel: () => void }) {
  return <section className="resource-manager-confirm" role="alertdialog" aria-label="确认替换 Resource Extension">
    <div><strong>替换 {pending.extension.名称}？</strong><span>图片 {pending.previousImageCount} → {pending.nextImageCount}；生成 ID {pending.generatedIds.length}</span>
      <ul>{pending.differences.map((item) => <li key={item.libraryId}><code>{item.libraryId}</code>：新增 {item.added} / 删除 {item.removed} / 保留 {item.retained}</li>)}</ul>
    </div>
    <div className="dialog-actions"><button className="icon-button" type="button" onClick={() => void onConfirm()}>确认替换</button><button className="icon-button secondary-button" type="button" onClick={onCancel}>取消</button></div>
  </section>;
}

function RemovalConfirmation({ pending, onConfirm, onCancel }: { pending: PendingResourceExtensionRemoval; onConfirm: () => Promise<void>; onCancel: () => void }) {
  return <section className="resource-manager-confirm result-error" role="alertdialog" aria-label="确认卸载 Resource Extension">
    <div><strong>卸载 {pending.extensionName}？</strong><span>{pending.libraries.reduce((sum, item) => sum + item.entryCount, 0)} Entries · {pending.imageCount} 图片</span><span>卸载后预计 {pending.staleReferenceCount} 个角色资源引用失效；Character Data 不会修改。</span></div>
    <div className="dialog-actions"><button className="icon-button" type="button" onClick={() => void onConfirm()}>确认卸载</button><button className="icon-button secondary-button" type="button" onClick={onCancel}>取消</button></div>
  </section>;
}

function linkedPickerNames(systemPackage: SystemPackage, libraryId: string): string[] {
  const otherLibraryIds = new Set(getOtherResourceLibraries(systemPackage).map((library) => library.ID));
  return systemPackage.modules.flatMap((module) => {
    if (module.类型 !== "resourcePicker") return [];
    if (module.资源库 === "其他") return otherLibraryIds.has(libraryId) ? [`Other：${module.按钮文本} (${module.ID})`] : [];
    return getResourcePickerLinks(module).some((link) => link.ID === libraryId) ? [`${module.按钮文本} (${module.ID})`] : [];
  });
}

function countExtensionImages(assetUrls: Record<string, string>, extensionId: string): number {
  const prefix = `resource-extension:${encodeURIComponent(extensionId)}:`;
  return Object.keys(assetUrls).filter((key) => key.startsWith(prefix)).length;
}

function ImportResult({ state }: { state: ResourceExtensionImportState }) {
  if (state.status === "error") {
    return (
      <section className="resource-manager-result result-error" role="alert">
        <strong>安装失败；现有资源未改变。</strong>
        <ul>{state.issues.map((issue, index) => <li key={`${issue.code}-${issue.path ?? index}`}><code>{issue.code}</code>{issue.path ? ` ${issue.path}` : ""}：{issue.text}</li>)}</ul>
      </section>
    );
  }

  const downloadNormalized = () => {
    const bytes = new ArrayBuffer(state.normalizedArtifact.bytes.byteLength);
    new Uint8Array(bytes).set(state.normalizedArtifact.bytes);
    const blob = new Blob([bytes], { type: state.normalizedArtifact.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = state.normalizedArtifact.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="resource-manager-result result-success" role="status">
      <div>
        <strong>Extension 已安装</strong>
        <span>{state.contributionCount} 个资源库贡献 · {state.entryCount} 条 Entry</span>
        {state.generatedIds.length > 0 ? <span>已补全 {state.generatedIds.length} 个稳定 ID；原文件不适合作为可靠更新源。</span> : null}
        {state.issues.map((issue) => <span key={`${issue.code}:${issue.path ?? issue.text}`}>{issue.code}：{issue.text}</span>)}
      </div>
      {state.generatedIds.length > 0 ? (
        <button className="icon-button secondary-button" type="button" onClick={downloadNormalized}>
          <Download aria-hidden="true" size={16} />
          <span>下载规范化 JSON</span>
        </button>
      ) : null}
    </section>
  );
}
