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
  createAuthSessionResolutionQueue,
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
  onSessionReplaced?(): void;
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

export async function reportPlatformSessionFailure(response: Response, credentials: PlatformCredentials | null): Promise<void> {
  if (response.ok || !credentials) return;
  const payload = await response.clone().json().catch(() => null);
  if (payload?.error?.code === "AUTH_SESSION_REPLACED") credentials.onSessionReplaced?.();
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
  const [acceptedAuthSession, setAcceptedAuthSession] = useState<AuthSession | null>(null);
  const confirmedProfileRef = useRef<AccountProfile | null>(null);
  const interactiveAuthRef = useRef(false);
  const invalidatedSessionRef = useRef<string | null>(null);
  const siteSessionRef = useRef<string | null>(readSiteSession());
  const [acceptedSiteSessionId, setAcceptedSiteSessionId] = useState(siteSessionRef.current);
  const authResolutionQueueRef = useRef(createAuthSessionResolutionQueue());

  const acceptSiteSession = useCallback((sessionId: string, nextProfile: AccountProfile) => {
    localStorage.setItem(siteSessionStorageKey, sessionId);
    siteSessionRef.current = sessionId;
    setAcceptedSiteSessionId(sessionId);
    confirmedProfileRef.current = nextProfile;
    invalidatedSessionRef.current = null;
    setProfile(nextProfile);
    setMessage(null);
    setStatus("authenticated");
  }, []);

  const resolveAuthSession = useCallback(async (session: AuthSession | null, allowTakeover = false, signedOut = false) => {
    if (!session) {
      if (confirmedProfileRef.current && !signedOut) return;
      authSessionRef.current = null;
      setAcceptedAuthSession(null);
      confirmedProfileRef.current = null;
      setProfile(null);
      setMessage(null);
      setStatus("anonymous");
      return;
    }

    const hadConfirmedProfile = confirmedProfileRef.current !== null;
    const currentSessionId = readSiteSession() ?? siteSessionRef.current;
    if (!allowTakeover && hadConfirmedProfile && currentSessionId
      && currentSessionId === siteSessionRef.current && session.accessToken === authSessionRef.current?.accessToken) return;
    if (allowTakeover || !hadConfirmedProfile || !currentSessionId) setStatus("working");
    try {
      const remote = await api.loadSessionStatus(session.accessToken, currentSessionId);
      if (currentSessionId !== (readSiteSession() ?? siteSessionRef.current) && !allowTakeover) return;
      authSessionRef.current = session;
      setAcceptedAuthSession(session);
      confirmedProfileRef.current = remote.profile;
      setProfile(remote.profile);
      const resolution = resolveSessionStatus({ ...remote,
        currentSessionActive: remote.currentSessionActive && invalidatedSessionRef.current !== currentSessionId,
      }, currentSessionId, allowTakeover);
      if (resolution === "acceptCurrent") {
        acceptSiteSession(currentSessionId!, remote.profile);
      } else if (resolution === "claim") {
        const claimed = await api.claimSession(session.accessToken, currentSessionId, allowTakeover);
        acceptSiteSession(claimed.sessionId, claimed.profile);
      } else {
        setMessage("另一台设备已继续。本地内容仍保留，云端写入已停止。");
        setStatus(resolution);
      }
    } catch (error) {
      if (currentSessionId !== (readSiteSession() ?? siteSessionRef.current) && !allowTakeover) return;
      setMessage(errorMessage(error));
      if (error instanceof AuthApiError && error.code === "AUTH_SESSION_REPLACED") {
        invalidatedSessionRef.current = siteSessionRef.current;
        setStatus("replaced");
      } else if (allowTakeover || !hadConfirmedProfile || !currentSessionId) setStatus("error");
    }
  }, [acceptSiteSession, api]);

  const enqueueAuthSession = useCallback((session: AuthSession | null, allowTakeover = false, signedOut = false) => (
    authResolutionQueueRef.current(() => resolveAuthSession(session, allowTakeover, signedOut))
  ), [resolveAuthSession]);

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
      unsubscribe = gateway.onAuthStateChange((session, event) => {
        if (!interactiveAuthRef.current) void enqueueAuthSession(session, false, event === "SIGNED_OUT");
      });
      await enqueueAuthSession(await gateway.getSession());
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
  }, [api, enqueueAuthSession, gatewayFactory]);

  useEffect(() => {
    const shareSessionAcrossTabs = (event: StorageEvent) => {
      if (event.key !== siteSessionStorageKey || !event.newValue || !authSessionRef.current) return;
      const session = authSessionRef.current;
      void api.loadProfile(session.accessToken, event.newValue)
        .then(({ profile: sharedProfile }) => {
          if (authSessionRef.current === session && readSiteSession() === event.newValue) acceptSiteSession(event.newValue!, sharedProfile);
        })
        .catch((error) => setMessage(errorMessage(error)));
    };
    window.addEventListener("storage", shareSessionAcrossTabs);
    return () => window.removeEventListener("storage", shareSessionAcrossTabs);
  }, [acceptSiteSession, api]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!gatewayRef.current) {
      setMessage("登录服务尚未配置，匿名功能仍可使用。");
      return;
    }
    setStatus("working");
    setMessage(null);
    interactiveAuthRef.current = true;
    try {
      const session = await gatewayRef.current.signIn(email, password);
      await enqueueAuthSession(session, true);
    } catch (error) {
      setMessage(errorMessage(error));
      setStatus("anonymous");
    } finally {
      interactiveAuthRef.current = false;
    }
  }, [enqueueAuthSession]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!gatewayRef.current) {
      setMessage("登录服务尚未配置，匿名功能仍可使用。");
      return;
    }
    setStatus("working");
    setMessage(null);
    interactiveAuthRef.current = true;
    try {
      const session = await gatewayRef.current.signUp(email, password);
      if (!session) {
        setMessage("注册成功，请通过邮件完成验证后登录。");
        setStatus("anonymous");
      } else await enqueueAuthSession(session, true);
    } catch (error) {
      setMessage(errorMessage(error));
      setStatus("anonymous");
    } finally {
      interactiveAuthRef.current = false;
    }
  }, [enqueueAuthSession]);

  const confirmReplacement = useCallback(async () => {
    if (authSessionRef.current) await enqueueAuthSession(authSessionRef.current, true);
  }, [enqueueAuthSession]);

  const updateUsername = useCallback(async (username: string) => {
    if (!authSessionRef.current || !siteSessionRef.current) return;
    const requestedSessionId = siteSessionRef.current;
    try {
      const result = await api.saveUsername(
        authSessionRef.current.accessToken,
        requestedSessionId,
        username,
      );
      if (siteSessionRef.current !== requestedSessionId || invalidatedSessionRef.current === requestedSessionId) return;
      confirmedProfileRef.current = result.profile;
      setProfile(result.profile);
      setMessage(null);
      setStatus("authenticated");
    } catch (error) {
      if (siteSessionRef.current !== requestedSessionId) return;
      setMessage(errorMessage(error));
      if (error instanceof AuthApiError && error.code === "AUTH_SESSION_REPLACED") {
        invalidatedSessionRef.current = requestedSessionId;
        setStatus("replaced");
      }
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
    setAcceptedSiteSessionId(null);
    authSessionRef.current = null;
    setAcceptedAuthSession(null);
    confirmedProfileRef.current = null;
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
      onSessionReplaced: () => {
        if (siteSessionRef.current !== siteSessionId) return;
        invalidatedSessionRef.current = siteSessionId;
        setMessage("另一台设备已继续。本地内容仍保留，云端写入已停止。");
        setStatus("replaced");
      },
    };
  }, [profile, status, acceptedAuthSession, acceptedSiteSessionId]);

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
