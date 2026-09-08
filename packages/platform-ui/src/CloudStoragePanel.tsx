import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth, platformRequestHeaders } from "@pbdh/platform-auth/provider";

type Usage = {
  usedBytes: number;
  limitBytes: number | null;
  unattachedBytes: number;
  dataBytes: number;
  entries: Array<{ id: string; name: string; kind: string; deleted: boolean; mediaBytes: number; ownedBytes: number; reclaimableBytes: number; dataBytes: number }>;
};

export function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function CloudStoragePanel() {
  const { credentials } = useAuth();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState("total");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  useEffect(() => {
    if (!credentials) return;
    const controller = new AbortController();
    setUsage(null);
    setError("");
    void fetch("/api/storage/usage", { headers: platformRequestHeaders(credentials), signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("云空间统计暂时不可用，请重试。");
        return await response.json() as Usage;
      })
      .then((value) => { if (!controller.signal.aborted) setUsage(value); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "统计加载失败。"); });
    return () => controller.abort();
  }, [credentials?.accountId, credentials?.accessToken, credentials?.siteSessionId, refresh]);
  const labels: Record<string, string> = { "creator-workspace": "工坊资源包", publication: "市场资源包", "character-save": "人物存档", "gm-tabletop-document": "GM 桌面" };
  const entries = (usage?.entries ?? []).filter((entry) => entry.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) && (!kind || entry.kind === kind))
    .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "zh-CN") :
      (sort === "data" ? b.dataBytes - a.dataBytes : sort === "media" ? b.ownedBytes - a.ownedBytes : (b.dataBytes + b.ownedBytes) - (a.dataBytes + a.ownedBytes)) || a.name.localeCompare(b.name, "zh-CN"));
  return <section className="pbdh-cloud-storage" aria-label="云空间">
    <header><strong>云空间</strong><button type="button" onClick={() => setRefresh((value) => value + 1)}>刷新</button></header>
    {error ? <p role="alert">{error}</p> : !usage ? <p role="status">正在统计…</p> : <>
      <p>内容占用 {formatStorageBytes(usage.usedBytes + usage.dataBytes)}</p>
      <p>图片额度 {formatStorageBytes(usage.usedBytes)} / {usage.limitBytes === null ? "未设上限" : formatStorageBytes(usage.limitBytes)}</p>
      {usage.limitBytes !== null && <progress aria-label="云空间用量" value={usage.usedBytes} max={usage.limitBytes} />}
      <p className="pbdh-storage-note">文字/数据 {formatStorageBytes(usage.dataBytes)} · 自有图片 {formatStorageBytes(usage.usedBytes)}</p>
      <button type="button" onClick={() => setOpen(true)}>查看明细 · {usage.entries.length} 项</button>
      {usage.unattachedBytes > 0 && <p>待关联图片：{formatStorageBytes(usage.unattachedBytes)}</p>}
    </>}
    {open && createPortal(<dialog ref={dialog} className="pbdh-storage-dialog" aria-labelledby="pbdh-storage-title" onClose={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="pbdh-storage-surface">
        <header><div><h2 id="pbdh-storage-title">云空间明细</h2><span>{usage ? `${usage.entries.length} 项` : "正在统计…"}</span></div><button type="button" aria-label="关闭云空间明细" title="关闭" onClick={() => dialog.current?.close()}>×</button></header>
        {error ? <p role="alert">{error}<button type="button" onClick={() => setRefresh((value) => value + 1)}>重试</button></p> : !usage ? <p role="status">正在统计…</p> : <>
          <dl className="pbdh-storage-totals"><div><dt>内容占用</dt><dd>{formatStorageBytes(usage.dataBytes + usage.usedBytes)}</dd></div><div><dt>文字/数据</dt><dd>{formatStorageBytes(usage.dataBytes)}</dd></div><div><dt>自有图片 · 去重</dt><dd>{formatStorageBytes(usage.usedBytes)}</dd></div></dl>
          <div className="pbdh-storage-toolbar">
            <label>名称<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <label>类型<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="">全部类型</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>排序<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="total">合计从大到小</option><option value="data">文字从大到小</option><option value="media">图片从大到小</option><option value="name">名称</option></select></label>
            <span role="status">{entries.length} / {usage.entries.length} 项</span>
          </div>
          <div className="pbdh-storage-table-scroll"><table><thead><tr><th scope="col">名称</th><th scope="col">类型</th><th scope="col">文字/数据</th><th scope="col">自有图片</th><th scope="col">合计</th></tr></thead><tbody>
            {entries.map((entry) => <tr key={`${entry.kind}:${entry.id}`}><th scope="row">{entry.name}{entry.deleted && <small title={`单独永久删除预计释放图片 ${formatStorageBytes(entry.reclaimableBytes)}`}>回收站</small>}</th><td>{labels[entry.kind] ?? entry.kind}</td><td>{formatStorageBytes(entry.dataBytes)}</td><td title={`含引用图片 ${formatStorageBytes(entry.mediaBytes)}`}>{formatStorageBytes(entry.ownedBytes)}</td><td>{formatStorageBytes(entry.dataBytes + entry.ownedBytes)}</td></tr>)}
          </tbody></table>{entries.length === 0 && <p className="pbdh-storage-empty">{usage.entries.length ? "没有匹配的资源包或文档。" : "暂无云端资源包或文档。"}</p>}</div>
          <footer>文字/数据按已存 JSON 的 UTF-8 字节统计，不占图片额度；不含数据库索引、归档副本和备份。同图跨包在总量中只计一次，各行合计不可直接相加。{usage.unattachedBytes > 0 && ` 待关联图片 ${formatStorageBytes(usage.unattachedBytes)}。`}</footer>
        </>}
      </div>
    </dialog>, document.body)}
  </section>;
}
