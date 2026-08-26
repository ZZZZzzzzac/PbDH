import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { AccountControl } from "@pbdh/platform-auth/provider";

import "./styles.css";

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

export function PlatformChrome({
  activePage,
  onNavigate,
  children,
}: {
  activePage: PlatformPage;
  onNavigate(page: PlatformPage): void;
  children: ReactNode;
}) {
  const [registrations, setRegistrations] = useState<Partial<Record<PlatformPage, AppBarRegistration>>>({});
  const register = useCallback<RegisterAppBarActions>((page, registration) => {
    const token = Symbol(page);
    setRegistrations((current) => ({ ...current, [page]: { token, ...registration } }));
    return () => setRegistrations((current) => {
      if (current[page]?.token !== token) return current;
      const next = { ...current };
      delete next[page];
      return next;
    });
  }, []);
  const navigation = useMemo(() => ({
    player: () => onNavigate("player"),
    creator: () => onNavigate("creator"),
    gm: () => onNavigate("gm"),
    market: () => onNavigate("market"),
  }), [onNavigate]);

  return <AppBarActionsContext.Provider value={register}>
    <PlatformAppBar
      activePage={activePage}
      onNavigate={navigation}
      extraActions={registrations[activePage]?.actions}
      accountManageLabel={registrations[activePage]?.accountManageLabel}
      onAccountManage={registrations[activePage]?.onAccountManage}
    />
    {children}
  </AppBarActionsContext.Provider>;
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
}: {
  activePage: PlatformPage;
  onNavigate?: Partial<Record<PlatformPage, () => void>>;
  accountManageLabel?: string;
  onAccountManage?: () => void;
  extraActions?: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
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
    {extraActions && <div className="pbdh-platform-extra">{extraActions}</div>}
    <div className="pbdh-platform-actions">
      <button type="button" aria-label="通知"><BarIcon kind="bell" /></button>
      <button type="button" aria-label="设置"><BarIcon kind="settings" /></button>
      <AccountControl
        className="pbdh-platform-account"
        icon={<BarIcon kind="user" />}
        manageLabel={accountManageLabel}
        onManage={onAccountManage}
      />
      <button className="pbdh-platform-mobile-button" type="button" aria-label="主页面" onClick={() => setMobileOpen((value) => !value)}>
        <BarIcon kind="menu" />
      </button>
    </div>
    {mobileOpen && <nav className="pbdh-platform-mobile-menu" aria-label="移动端主页面">
      {pages.map((page) => <button
        type="button"
        key={page.id}
        className={page.id === activePage ? "is-current" : ""}
        onClick={() => navigate(page.id)}
      >{page.label}</button>)}
    </nav>}
  </header>;
}

function BarIcon({ kind }: { kind: "bell" | "settings" | "user" | "menu" }) {
  const paths = {
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7" /><path d="M10 20h4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.5 1A7 7 0 0 0 15 6l-.4-2.7h-4L10 6a7 7 0 0 0-1.4 1L6 6 4 9.5 6.1 11a7 7 0 0 0 0 2L4 14.5 6 18l2.6-1a7 7 0 0 0 1.4 1l.5 2.7h4L15 18a7 7 0 0 0 1.4-1l2.6 1 2-3.5-2.1-1.5a7 7 0 0 0 .1-1Z" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>;
}
