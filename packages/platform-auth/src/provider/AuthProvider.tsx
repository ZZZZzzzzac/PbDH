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

import {
  AuthApiError,
  createAuthApi,
  isAuthConfigured,
  resolveSessionStatus,
  type AccountProfile,
  type AuthApi,
  type AuthGateway,
  type AuthGatewayFactory,
  type AuthSession,
  type AuthStatus,
} from "../core/index.ts";

const siteSessionStorageKey = "pbdh-platform-site-session";
const defaultAuthApi = createAuthApi();
const loadSupabaseGateway: AuthGatewayFactory = async (config) => {
  const { createSupabaseGateway } = await import("../core/supabase-gateway.ts");
  return createSupabaseGateway(config);
};

export type PlatformCredentials = {
  accessToken: string;
  siteSessionId: string;
  accountId: string;
  canWrite: boolean;
};

export function platformRequestHeaders(
  credentials: PlatformCredentials,
  initial?: HeadersInit,
): Headers {
  const headers = new Headers(initial);
  headers.set("Authorization", `Bearer ${credentials.accessToken}`);
  headers.set("X-PbDH-Session", credentials.siteSessionId);
  return headers;
}

export type AuthContextValue = {
  status: AuthStatus;
  authAvailable: boolean;
  profile: AccountProfile | null;
  message: string | null;
  credentials: PlatformCredentials | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  confirmReplacement(): Promise<void>;
  updateUsername(username: string): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  gatewayFactory = loadSupabaseGateway,
  api = defaultAuthApi,
}: {
  children: ReactNode;
  gatewayFactory?: AuthGatewayFactory;
  api?: AuthApi;
}) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [authAvailable, setAuthAvailable] = useState(false);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const gatewayRef = useRef<AuthGateway | null>(null);
  const authSessionRef = useRef<AuthSession | null>(null);
  const siteSessionRef = useRef<string | null>(readSiteSession());

  const acceptSiteSession = useCallback((sessionId: string, nextProfile: AccountProfile) => {
    localStorage.setItem(siteSessionStorageKey, sessionId);
    siteSessionRef.current = sessionId;
    setProfile(nextProfile);
    setMessage(null);
    setStatus("authenticated");
  }, []);

  const resolveAuthSession = useCallback(async (session: AuthSession | null) => {
    authSessionRef.current = session;
    if (!session) {
      clearSiteSession();
      siteSessionRef.current = null;
      setProfile(null);
      setMessage(null);
      setStatus("anonymous");
      return;
    }

    setStatus("working");
    try {
      const currentSessionId = siteSessionRef.current;
      const remote = await api.loadSessionStatus(session.accessToken, currentSessionId);
      setProfile(remote.profile);
      const resolution = resolveSessionStatus(remote, currentSessionId);
      if (resolution === "acceptCurrent") {
        acceptSiteSession(currentSessionId!, remote.profile);
      } else if (resolution === "claim") {
        const claimed = await api.claimSession(session.accessToken, currentSessionId, false);
        acceptSiteSession(claimed.sessionId, claimed.profile);
      } else {
        setStatus(resolution);
      }
    } catch (error) {
      setMessage(errorMessage(error));
      setStatus(error instanceof AuthApiError && error.code === "AUTH_SESSION_REPLACED" ? "replaced" : "error");
    }
  }, [acceptSiteSession, api]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void api.loadConfig().then(async (config) => {
      if (cancelled) return;
      if (!isAuthConfigured(config)) {
        setAuthAvailable(false);
        setStatus("anonymous");
        return;
      }
      setAuthAvailable(true);
      const gateway = await gatewayFactory({
        supabaseUrl: config.supabaseUrl,
        supabaseAnonKey: config.supabaseAnonKey,
      });
      if (cancelled) return;
      gatewayRef.current = gateway;
      unsubscribe = gateway.onAuthStateChange((session) => void resolveAuthSession(session));
      await resolveAuthSession(await gateway.getSession());
    }).catch((error) => {
      if (cancelled) return;
      setAuthAvailable(false);
      setMessage(`登录服务暂不可用：${errorMessage(error)}`);
      setStatus("anonymous");
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [api, gatewayFactory, resolveAuthSession]);

  useEffect(() => {
    const shareSessionAcrossTabs = (event: StorageEvent) => {
      if (event.key !== siteSessionStorageKey || !event.newValue || !authSessionRef.current) return;
      siteSessionRef.current = event.newValue;
      void api.loadProfile(authSessionRef.current.accessToken, event.newValue)
        .then(({ profile: sharedProfile }) => acceptSiteSession(event.newValue!, sharedProfile))
        .catch(() => undefined);
    };
    window.addEventListener("storage", shareSessionAcrossTabs);
    return () => window.removeEventListener("storage", shareSessionAcrossTabs);
  }, [acceptSiteSession, api]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const timer = window.setInterval(() => {
      const authSession = authSessionRef.current;
      const siteSessionId = siteSessionRef.current;
      if (!authSession || !siteSessionId) return;
      void api.loadProfile(authSession.accessToken, siteSessionId).catch((error) => {
        if (error instanceof AuthApiError && error.code === "AUTH_SESSION_REPLACED") {
          setMessage("另一台设备已登录。本地内容仍保留，云端写入已停止。");
          setStatus("replaced");
        }
      });
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [api, status]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!gatewayRef.current) {
      setMessage("登录服务尚未配置，匿名功能仍可使用。");
      return;
    }
    setStatus("working");
    setMessage(null);
    try {
      await gatewayRef.current.signIn(email, password);
    } catch (error) {
      setMessage(errorMessage(error));
      setStatus("anonymous");
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!gatewayRef.current) {
      setMessage("登录服务尚未配置，匿名功能仍可使用。");
      return;
    }
    setStatus("working");
    setMessage(null);
    try {
      const session = await gatewayRef.current.signUp(email, password);
      if (!session) {
        setMessage("注册成功，请通过邮件完成验证后登录。");
        setStatus("anonymous");
      }
    } catch (error) {
      setMessage(errorMessage(error));
      setStatus("anonymous");
    }
  }, []);

  const confirmReplacement = useCallback(async () => {
    if (!authSessionRef.current) return;
    setStatus("working");
    try {
      const claimed = await api.claimSession(
        authSessionRef.current.accessToken,
        siteSessionRef.current,
        true,
      );
      acceptSiteSession(claimed.sessionId, claimed.profile);
    } catch (error) {
      setMessage(errorMessage(error));
      setStatus("error");
    }
  }, [acceptSiteSession, api]);

  const updateUsername = useCallback(async (username: string) => {
    if (!authSessionRef.current || !siteSessionRef.current) return;
    setStatus("working");
    try {
      const result = await api.saveUsername(
        authSessionRef.current.accessToken,
        siteSessionRef.current,
        username,
      );
      setProfile(result.profile);
      setMessage(null);
      setStatus("authenticated");
    } catch (error) {
      setMessage(errorMessage(error));
      setStatus("authenticated");
    }
  }, [api]);

  const signOut = useCallback(async () => {
    const authSession = authSessionRef.current;
    const siteSessionId = siteSessionRef.current;
    if (authSession && siteSessionId) {
      await api.releaseSession(authSession.accessToken, siteSessionId).catch(() => undefined);
    }
    await gatewayRef.current?.signOut().catch(() => undefined);
    clearSiteSession();
    siteSessionRef.current = null;
    authSessionRef.current = null;
    setProfile(null);
    setMessage(null);
    setStatus("anonymous");
  }, [api]);

  const credentials = useMemo<PlatformCredentials | null>(() => {
    const authSession = authSessionRef.current;
    const siteSessionId = siteSessionRef.current;
    if (!authSession || !siteSessionId || !profile || !["authenticated", "replaced"].includes(status)) return null;
    return {
      accessToken: authSession.accessToken,
      siteSessionId,
      accountId: profile.accountId,
      canWrite: status === "authenticated",
    };
  }, [profile, status]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    authAvailable,
    profile,
    message,
    credentials,
    signIn,
    signUp,
    confirmReplacement,
    updateUsername,
    signOut,
  }), [
    status,
    authAvailable,
    profile,
    message,
    credentials,
    signIn,
    signUp,
    confirmReplacement,
    updateUsername,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return context;
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}

function readSiteSession(): string | null {
  return typeof localStorage === "undefined" ? null : localStorage.getItem(siteSessionStorageKey);
}

function clearSiteSession(): void {
  if (typeof localStorage !== "undefined") localStorage.removeItem(siteSessionStorageKey);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "账号请求失败，请稍后重试。";
}
