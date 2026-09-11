import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { AccountControl } from "@pbdh/platform-auth/provider";
import { CloudStoragePanel } from "./CloudStoragePanel.tsx";
import { TutorialEntry } from "./TutorialDialog.tsx";
export { formatStorageBytes } from "./CloudStoragePanel.tsx";

import "./styles.css";

export { ImageCropDialog, type ImageCropDialogProps } from "./ImageCropDialog.tsx";

export type PlatformPage = "player" | "creator" | "gm" | "market";

const pages: Array<{ id: PlatformPage; label: string }> = [
  { id: "player", label: "玩家车卡器" },
  { id: "creator", label: "卡牌工坊" },
  { id: "gm", label: "GM 桌面" },
  { id: "market", label: "资源市场" },
];

type AppBarRegistration = {
  token: symbol;
  actions?: ReactNode;
  accountManageLabel?: string;
  onAccountManage?: () => void;
};
type RegisterAppBarActions = (
  page: PlatformPage,
  registration: Omit<AppBarRegistration, "token">,
) => () => void;

const AppBarActionsContext = createContext<RegisterAppBarActions | null>(null);

type PlatformNotification = {
  id: number;
  message: string;
};

type PlatformNotifications = {
  notify(message: string): void;
};

const PlatformNotificationsContext = createContext<PlatformNotifications | null>(null);

export function OperationStatus({
  label = "保存中…",
  size = "compact",
  className = "",
}: {
  label?: string;
  size?: "compact" | "regular";
  className?: string;
}) {
  return <span
    className={`pbdh-operation-status is-${size}${className ? ` ${className}` : ""}`}
    role="status"
    aria-live="polite"
  >
    <span className="pbdh-operation-status-spinner" aria-hidden="true" />
    <span>{label}</span>
  </span>;
}

export type PlatformTrashItem = {
  id: string;
  name: string;
  documentType: "人物存档" | "资源工作区" | "GM 桌面";
  location: "local" | "cloud";
  deletedAt: string;
  purgeAfter: string | null;
};

export type PlatformTrashSource = {
  id: string;
  label?: string;
  location?: "local" | "cloud";
  list(): Promise<PlatformTrashItem[]>;
  restore(itemId: string): Promise<void>;
  deletePermanently(itemId: string): Promise<void>;
};

type RegisterTrashSource = (source: PlatformTrashSource) => () => void;
const PlatformTrashContext = createContext<RegisterTrashSource | null>(null);

export function PlatformChrome({
  activePage,
  onNavigate,
  children,
}: {
  activePage: PlatformPage;
  onNavigate(page: PlatformPage): void;
  children: ReactNode;
}) {
  const [registrations, setRegistrations] = useState<Partial<Record<PlatformPage, AppBarRegistration[]>>>({});
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [trashSources, setTrashSources] = useState<PlatformTrashSource[]>([]);
  const nextNotificationId = useRef(1);
  const register = useCallback<RegisterAppBarActions>((page, registration) => {
    const token = Symbol(page);
    setRegistrations((current) => ({
      ...current,
      [page]: [...(current[page] ?? []), { token, ...registration }],
    }));
    return () => setRegistrations((current) => {
      const pageRegistrations = current[page];
      if (!pageRegistrations?.some((candidate) => candidate.token === token)) return current;
      const next = { ...current };
      const remaining = pageRegistrations.filter((candidate) => candidate.token !== token);
      if (remaining.length > 0) next[page] = remaining;
      else delete next[page];
      return next;
    });
  }, []);
  const navigation = useMemo(() => ({
    player: () => onNavigate("player"),
    creator: () => onNavigate("creator"),
    gm: () => onNavigate("gm"),
    market: () => onNavigate("market"),
  }), [onNavigate]);
  const notificationApi = useMemo<PlatformNotifications>(() => ({
    notify(message) {
      const id = nextNotificationId.current++;
      setNotifications((current) => current.at(-1)?.message === message
        ? current
        : [...current, { id, message }]);
    },
  }), []);
  const registerTrashSource = useCallback<RegisterTrashSource>((source) => {
    setTrashSources((current) => [...current.filter((candidate) => candidate.id !== source.id), source]);
    return () => setTrashSources((current) => current.filter((candidate) => candidate !== source));
  }, []);

  const activeRegistrations = registrations[activePage] ?? [];
  const actions = activeRegistrations.findLast((candidate) => candidate.actions !== undefined)?.actions;
  const accountManagement = activeRegistrations.findLast((candidate) =>
    candidate.accountManageLabel !== undefined && candidate.onAccountManage !== undefined);

  return <PlatformNotificationsContext.Provider value={notificationApi}>
    <PlatformTrashContext.Provider value={registerTrashSource}>
    <AppBarActionsContext.Provider value={register}>
      <PlatformAppBar
        activePage={activePage}
        onNavigate={navigation}
        extraActions={actions}
        accountManageLabel={accountManagement?.accountManageLabel}
        onAccountManage={accountManagement?.onAccountManage}
        notifications={notifications}
        onDismissNotification={(id) => setNotifications((current) => current.filter((item) => item.id !== id))}
        onClearNotifications={() => setNotifications([])}
        trashSources={trashSources}
      />
      {children}
    </AppBarActionsContext.Provider>
    </PlatformTrashContext.Provider>
  </PlatformNotificationsContext.Provider>;
}

export function usePlatformNotifications(): PlatformNotifications {
  const notifications = useContext(PlatformNotificationsContext);
  if (!notifications) throw new Error("usePlatformNotifications 必须在 PlatformChrome 内使用");
  return notifications;
}

export function usePlatformTrashSource(source: PlatformTrashSource): void {
  const register = useContext(PlatformTrashContext);
  useEffect(() => register?.(source), [register, source]);
}

export function usePlatformAppBarActions(page: PlatformPage, actions: ReactNode): void {
  const register = useContext(AppBarActionsContext);
  useEffect(() => register?.(page, { actions }), [actions, page, register]);
}

export function usePlatformAccountManagement(
  page: PlatformPage,
  label: string,
  onManage: () => void,
): void {
  const register = useContext(AppBarActionsContext);
  useEffect(
    () => register?.(page, { accountManageLabel: label, onAccountManage: onManage }),
    [label, onManage, page, register],
  );
}

export function PlatformAppBar({
  activePage,
  onNavigate,
  accountManageLabel,
  onAccountManage,
  extraActions,
  notifications = [],
  onDismissNotification,
  onClearNotifications,
  trashSources = [],
}: {
  activePage: PlatformPage;
  onNavigate?: Partial<Record<PlatformPage, () => void>>;
  accountManageLabel?: string;
  onAccountManage?: () => void;
  extraActions?: ReactNode;
  notifications?: PlatformNotification[];
  onDismissNotification?: (id: number) => void;
  onClearNotifications?: () => void;
  trashSources?: PlatformTrashSource[];
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const navigate = (page: PlatformPage) => {
    setMobileOpen(false);
    onNavigate?.[page]?.();
  };

  return <header className="pbdh-platform-appbar">
    <button className="pbdh-platform-brand" type="button" aria-label="PbDH 首页" onClick={() => navigate("player")}>
      <b>PB</b><strong>PbDH</strong>
    </button>
    <nav className="pbdh-platform-nav" aria-label="主页面">
      {pages.map((page) => <button
        type="button"
        key={page.id}
        className={page.id === activePage ? "is-current" : ""}
        onClick={() => navigate(page.id)}
      >{page.label}</button>)}
    </nav>
    <div className="pbdh-platform-extra">{extraActions}</div>
    <div className="pbdh-platform-actions">
      <TutorialEntry />
      <button type="button" aria-label="回收站" onClick={() => setTrashOpen(true)}><BarIcon kind="trash" /></button>
      <div className="pbdh-platform-notification-menu" onMouseLeave={() => setNotificationsOpen(false)}>
        <button
          className="pbdh-platform-notification-button"
          type="button"
          aria-label="通知"
          aria-expanded={notificationsOpen}
          onClick={() => setNotificationsOpen((value) => !value)}
        >
          <BarIcon kind="bell" />
          {notifications.length > 0 ? <span>{notifications.length}</span> : null}
        </button>
        {notificationsOpen ? <section className="pbdh-platform-notification-panel" aria-label="PbDH 通知">
          <header>
            <strong>通知</strong>
            {notifications.length > 0 ? <button type="button" onClick={onClearNotifications}>全部清除</button> : null}
          </header>
          {notifications.length === 0 ? <p>暂无通知</p> : <ol>
            {notifications.map((notification) => <li key={notification.id}>
              <span>{notification.message}</span>
              <button type="button" aria-label="关闭通知" onClick={() => onDismissNotification?.(notification.id)}>×</button>
            </li>)}
          </ol>}
        </section> : null}
      </div>
      <button type="button" aria-label="设置"><BarIcon kind="settings" /></button>
      <AccountControl
        className="pbdh-platform-account"
        icon={<BarIcon kind="user" />}
        manageLabel={accountManageLabel}
        onManage={onAccountManage}
        accountContent={<CloudStoragePanel />}
      />
      <button
        className="pbdh-platform-mobile-button"
        type="button"
        aria-label="主页面"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((value) => !value)}
      >
        <BarIcon kind="menu" />
      </button>
    </div>
    {trashOpen ? <PlatformTrashDialog sources={trashSources} onClose={() => setTrashOpen(false)} /> : null}
    {mobileOpen && <div className="pbdh-platform-mobile-menu">
      <nav className="pbdh-platform-mobile-pages" aria-label="移动端主页面">
        {pages.map((page) => <button
          type="button"
          key={page.id}
          className={page.id === activePage ? "is-current" : ""}
          onClick={() => navigate(page.id)}
        >{page.label}</button>)}
      </nav>
      {extraActions ? <div className="pbdh-platform-mobile-extra">{extraActions}</div> : null}
    </div>}
  </header>;
}

function PlatformTrashDialog({
  sources,
  onClose,
}: {
  sources: PlatformTrashSource[];
  onClose(): void;
}) {
  const [items, setItems] = useState<Array<PlatformTrashItem & { sourceId: string }>>([]);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [error, setError] = useState("");
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [loadedSources, setLoadedSources] = useState(sources);
  const currentSources = useRef(sources);
  currentSources.current = sources;
  const requestSequence = useRef(0);
  const [operation, setOperation] = useState<{ key: string; action: "restore" | "delete" } | null>(null);
  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setStatus("loading");
    setItems([]);
    setLoadedSources(sources);
    setLoadErrors([]);
    setError("");
    const groups = await Promise.allSettled(sources.map(readTrashSource));
    if (sequence !== requestSequence.current || currentSources.current !== sources) return;
    const nextItems: Array<PlatformTrashItem & { sourceId: string }> = [];
    const failures: string[] = [];
    groups.forEach((group, index) => {
      const source = sources[index]!;
      if (group.status === "fulfilled") nextItems.push(...group.value.map((item) => ({ ...item, sourceId: source.id })));
      else failures.push(trashFailure(source, "读取", group.reason));
    });
    setItems(nextItems.sort((left, right) => right.deletedAt.localeCompare(left.deletedAt)));
    setLoadErrors(failures);
    setStatus("ready");
  }, [sources]);
  useEffect(() => {
    void refresh();
    return () => { requestSequence.current += 1; };
  }, [refresh]);
  const loading = status === "loading" || loadedSources !== sources;
  const visibleItems = loadedSources === sources ? items : [];
  const act = async (item: PlatformTrashItem & { sourceId: string }, action: "restore" | "delete") => {
    if (operation || loading) return;
    const source = sources.find((candidate) => candidate.id === item.sourceId);
    if (!source) return;
    if (action === "delete" && !window.confirm(`永久删除“${item.name}”？删除后不能恢复。`)) return;
    const key = `${item.sourceId}:${item.id}`;
    setOperation({ key, action });
    setError("");
    try {
      if (action === "restore") await source.restore(item.id);
      else await source.deletePermanently(item.id);
      if (currentSources.current === sources) await refresh();
    } catch (reason) {
      if (currentSources.current === sources) setError(trashFailure(source, action === "restore" ? "恢复" : "永久删除", reason, item.name));
    } finally {
      setOperation(null);
    }
  };
  const deleteAll = async () => {
    if (operation || loading || error || loadErrors.length || !items.length) return;
    if (!window.confirm(`永久删除回收站中的全部 ${items.length} 项（包含本机和云端内容）？删除后不能恢复。`)) return;
    setOperation({ key: "all", action: "delete" });
    let failure = "";
    try {
      for (const item of items) {
        if (currentSources.current !== sources) break;
        const source = sources.find((candidate) => candidate.id === item.sourceId);
        if (!source) throw new Error(`无法删除“${item.name}”：来源不可用。`);
        try {
          await source.deletePermanently(item.id);
        } catch (reason) {
          failure = trashFailure(source, "永久删除", reason, item.name);
          break;
        }
      }
    } catch (reason) {
      failure = reason instanceof Error ? reason.message : "全部删除失败";
    } finally {
      if (currentSources.current === sources) {
        await refresh();
        if (failure) setError(failure);
      }
      setOperation(null);
    }
  };
  return <div className="pbdh-platform-trash-backdrop" role="presentation">
    <section className="pbdh-platform-trash-dialog" role="dialog" aria-modal="true" aria-label="回收站">
      <header><div><strong>回收站</strong><small>内容保留 30 天，之后自动永久删除</small></div><button type="button" aria-label="关闭回收站" disabled={Boolean(operation)} onClick={onClose}>×</button></header>
      <div className="pbdh-platform-trash-body">
      {error ? <p className="pbdh-platform-trash-error" role="alert">{error}</p> : null}
      {!loading && loadErrors.length > 0 ? <div className="pbdh-platform-trash-error" role="alert">{loadErrors.map((message) => <p key={message}>{message}</p>)}</div> : null}
      {loading ? <p className="pbdh-platform-trash-empty">正在读取…</p> : visibleItems.length === 0
        ? <p className="pbdh-platform-trash-empty">{loadErrors.length ? "回收站未能完整读取，无法确认是否为空" : "回收站为空"}</p>
        : <ol>{visibleItems.map((item) => <li key={`${item.sourceId}:${item.id}`}>
          <div><strong>{item.name}</strong><small>{item.documentType} · {item.location === "cloud" ? "云端" : "本机"}{remainingDays(item.purgeAfter)}</small></div>
          <div><button type="button" disabled={Boolean(operation)} onClick={() => void act(item, "restore")}>{operation?.key === `${item.sourceId}:${item.id}` && operation.action === "restore" ? <OperationStatus label="正在恢复…" /> : "恢复"}</button><button type="button" className="danger" disabled={Boolean(operation)} onClick={() => void act(item, "delete")}>{operation?.key === `${item.sourceId}:${item.id}` && operation.action === "delete" ? <OperationStatus label="正在删除…" /> : "永久删除"}</button></div>
        </li>)}</ol>}
      </div>
      <footer className="pbdh-platform-trash-footer"><span>{loading ? "正在读取" : loadErrors.length ? visibleItems.length ? `已读取 ${visibleItems.length} 项 · 列表不完整` : "列表未完整读取" : `${visibleItems.length} 项`}</span><button type="button" className="danger" disabled={loading || !visibleItems.length || Boolean(operation) || Boolean(error) || loadErrors.length > 0} onClick={() => void deleteAll()}>{operation?.key === "all" ? <OperationStatus label="正在全部删除…" /> : <><BarIcon kind="trash" />全部删除</>}</button><button type="button" disabled={loading || Boolean(operation)} onClick={() => void refresh()}>刷新</button></footer>
    </section>
  </div>;
}

function readTrashSource(source: PlatformTrashSource): Promise<PlatformTrashItem[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new DOMException("", "TimeoutError")), 15_000);
    Promise.resolve().then(() => source.list()).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function trashFailure(source: PlatformTrashSource, action: string, reason: unknown, itemName?: string): string {
  const failure = reason && typeof reason === "object" ? reason as { name?: string; message?: string; code?: string; status?: number; stage?: string; cause?: unknown } : {};
  const cause = failure.cause && typeof failure.cause === "object" ? failure.cause as { name?: string } : failure;
  const local = source.location === "local";
  const stage = failure.stage === "cleanup" ? "清理过期记录" : action;
  let code = local ? "TRASH_LOCAL_STORAGE" : "TRASH_LOAD_FAILED";
  let guidance = local
    ? "浏览器本地存储未能完成操作。请关闭本站其他标签页后重试；仍失败请重启浏览器。不要清除网站数据。"
    : "请检查网络后刷新重试；仍失败请将此提示反馈给维护者。";
  if (failure.message === "工作区已有同 ID 资源包，已保留工作区内容，不能用回收站版本覆盖。") {
    code = "TRASH_ACTIVE_WORKSPACE_EXISTS";
    guidance = "工作区已有同 ID 资源包。工作区内容优先，未用回收站版本覆盖。";
  } else if (failure.name === "LocalDocumentChangedError") {
    code = "TRASH_LOCAL_DOCUMENT_CHANGED";
    guidance = "操作期间本地内容已更新，已停止处理旧版本。请先导出当前内容备份，再确认操作。";
  } else if (cause.name === "TimeoutError") {
    code = "TRASH_TIMEOUT";
    guidance = "等待超过 15 秒，请刷新重试；本机来源可尝试重启浏览器，云端来源请检查网络。";
  } else if (cause.name === "QuotaExceededError") {
    code = "TRASH_STORAGE_QUOTA";
    guidance = "浏览器存储空间不足。请释放设备空间后重试，不要清除本站数据。";
  } else if (cause.name === "SecurityError" || cause.name === "NotAllowedError") {
    code = "TRASH_STORAGE_BLOCKED";
    guidance = "浏览器阻止了存储访问。请检查本站权限与隐私设置后重试，不要清除网站数据。";
  } else if (source.location === "cloud") {
    code = "TRASH_CLOUD_REQUEST";
    guidance = "云端请求未能完成。请检查网络和登录状态后刷新重试；仍失败请将此提示反馈给维护者。";
    if (failure.status === 401) {
      code = "TRASH_SIGN_IN_REQUIRED";
      guidance = "登录状态已失效，请重新登录后重试。本机回收站不受影响。";
    } else if (failure.status === 403) {
      code = "TRASH_PERMISSION_DENIED";
      guidance = "当前账号或会话没有操作权限，请检查登录账号与活动会话后重试。";
    } else if (failure.status === 404 || failure.status === 409) {
      code = "TRASH_DOCUMENT_CHANGED";
      guidance = "云端文档已不存在或状态已改变，请刷新列表后确认；不要重复提交旧操作。";
    } else if (failure.status && failure.status >= 500) {
      code = "TRASH_SERVER_ERROR";
      guidance = "云端服务暂时异常，请稍后刷新重试；持续失败请反馈给维护者。";
    }
  }
  return `${source.label ?? source.id}${itemName ? `“${itemName}”` : ""}：${stage}失败。${guidance}（${code}）`;
}

function remainingDays(purgeAfter: string | null): string {
  if (!purgeAfter) return "";
  const days = Math.max(0, Math.ceil((Date.parse(purgeAfter) - Date.now()) / 86_400_000));
  return ` · 剩余 ${days} 天`;
}

function BarIcon({ kind }: { kind: "bell" | "settings" | "user" | "menu" | "trash" }) {
  const paths = {
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7" /><path d="M10 20h4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.5 1A7 7 0 0 0 15 6l-.4-2.7h-4L10 6a7 7 0 0 0-1.4 1L6 6 4 9.5 6.1 11a7 7 0 0 0 0 2L4 14.5 6 18l2.6-1a7 7 0 0 0 1.4 1l.5 2.7h4L15 18a7 7 0 0 0 1.4-1l2.6 1 2-3.5-2.1-1.5a7 7 0 0 0 .1-1Z" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    trash: <><path d="M3 6h18M19 6l-1 14H6L5 6M8 6V4h8v2M10 11v5M14 11v5" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>;
}
