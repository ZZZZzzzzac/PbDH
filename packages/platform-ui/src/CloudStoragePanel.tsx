import { useEffect, useState } from "react";
import { useAuth, platformRequestHeaders } from "@pbdh/platform-auth/provider";

type Usage = {
  usedBytes: number;
  limitBytes: number | null;
  unattachedBytes: number;
  entries: Array<{ id: string; name: string; kind: string; deleted: boolean; mediaBytes: number; ownedBytes: number; reclaimableBytes: number }>;
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
  return <section className="pbdh-cloud-storage" aria-label="云空间">
    <header><strong>云空间</strong><button type="button" onClick={() => setRefresh((value) => value + 1)}>刷新</button></header>
    {error ? <p role="alert">{error}</p> : !usage ? <p role="status">正在统计…</p> : <>
      <p>已用 {formatStorageBytes(usage.usedBytes)} / {usage.limitBytes === null ? "未设上限" : formatStorageBytes(usage.limitBytes)}</p>
      {usage.limitBytes !== null && <progress aria-label="云空间用量" value={usage.usedBytes} max={usage.limitBytes} />}
      <p className="pbdh-storage-note">仅计自有图片，同图跨包只计一次；他人的市场图片和纯文本不占额度。各包占用不可直接相加。</p>
      <details><summary>按资源包查看 · {usage.entries.length} 项</summary>
        <div className="pbdh-storage-list">{usage.entries.map((entry) => <article key={`${entry.kind}:${entry.id}`}>
          <strong>{entry.name}</strong><small>{entry.deleted ? "回收站 · " : ""}{labels[entry.kind] ?? entry.kind}</small>
          <span>图片 {formatStorageBytes(entry.mediaBytes)} · 云占用 {formatStorageBytes(entry.ownedBytes)}</span>
          {entry.deleted && <span>单独永久删除预计释放 {formatStorageBytes(entry.reclaimableBytes)}</span>}
        </article>)}{usage.entries.length === 0 && <p>暂无云端资源包或文档。</p>}</div>
      </details>
      {usage.unattachedBytes > 0 && <p>待关联图片：{formatStorageBytes(usage.unattachedBytes)}</p>}
    </>}
  </section>;
}
