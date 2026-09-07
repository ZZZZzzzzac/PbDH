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
export { formatStorageBytes } from "./CloudStoragePanel.tsx";

import "./styles.css";

export { ImageCropDialog, type ImageCropDialogProps } from "./ImageCropDialog.tsx";

export type PlatformPage = "player" | "creator" | "gm" | "market";

const pages: Array<{ id: PlatformPage; label: string }> = [
  { id: "player", label: "玩家车卡器" },
  { id: "creator", label: "卡片工坊" },
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
  const [operation, setOperation] = useState<{ key: string; action: "restore" | "delete" } | null>(null);
  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setStatus("loading");
    setError("");
    try {
      const groups = await Promise.all(sources.map(async (source) =>
        (await source.list()).map((item) => ({ ...item, sourceId: source.id }))));
      setItems(groups.flat().sort((left, right) => right.deletedAt.localeCompare(left.deletedAt)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "回收站读取失败");
    } finally {
      setStatus("ready");
    }
  }, [sources]);
  useEffect(() => { void refresh(); }, [refresh]);
  const act = async (item: PlatformTrashItem & { sourceId: string }, action: "restore" | "delete") => {
    if (operation) return;
    const source = sources.find((candidate) => candidate.id === item.sourceId);
    if (!source) return;
    if (action === "delete" && !window.confirm(`永久删除“${item.name}”？删除后不能恢复。`)) return;
    const key = `${item.sourceId}:${item.id}`;
    setOperation({ key, action });
    setError("");
    try {
      if (action === "restore") await source.restore(item.id);
      else await source.deletePermanently(item.id);
      await refresh(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "回收站操作失败");
    } finally {
      setOperation(null);
    }
  };
  return <div className="pbdh-platform-trash-backdrop" role="presentation">
    <section className="pbdh-platform-trash-dialog" role="dialog" aria-modal="true" aria-label="回收站">
      <header><div><strong>回收站</strong><small>内容保留 30 天，之后自动永久删除</small></div><button type="button" aria-label="关闭回收站" disabled={Boolean(operation)} onClick={onClose}>×</button></header>
      {error ? <p className="pbdh-platform-trash-error" role="alert">{error}</p> : null}
      {status === "loading" ? <p className="pbdh-platform-trash-empty">正在读取…</p> : items.length === 0
        ? <p className="pbdh-platform-trash-empty">回收站为空</p>
        : <ol>{items.map((item) => <li key={`${item.sourceId}:${item.id}`}>
          <div><strong>{item.name}</strong><small>{item.documentType} · {item.location === "cloud" ? "云端" : "本机"}{remainingDays(item.purgeAfter)}</small></div>
          <div><button type="button" disabled={Boolean(operation)} onClick={() => void act(item, "restore")}>{operation?.key === `${item.sourceId}:${item.id}` && operation.action === "restore" ? <OperationStatus label="正在恢复…" /> : "恢复"}</button><button type="button" className="danger" disabled={Boolean(operation)} onClick={() => void act(item, "delete")}>{operation?.key === `${item.sourceId}:${item.id}` && operation.action === "delete" ? <OperationStatus label="正在删除…" /> : "永久删除"}</button></div>
        </li>)}</ol>}
    </section>
  </div>;
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
