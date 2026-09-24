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
import { clearPasswordRecoveryUrl, isPasswordRecoveryUrl, passwordRecoveryRedirect, recoveryErrorMessage, type RecoveryState } from "../core/password-recovery.ts";

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
  recovery: RecoveryState;
  recoveryBusy: boolean;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(password: string): Promise<void>;
  cancelRecovery(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  gatewayFactory = loadSupabaseGateway,
  api = defaultAuthApi,
  basePath = "/",
}: {
  children: ReactNode;
  gatewayFactory?: AuthGatewayFactory;
  api?: AuthApi;
  basePath?: string;
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
  const [recovery, setRecovery] = useState<RecoveryState>(() => isPasswordRecoveryUrl(window.location.href) ? "loading" : "none");
  const recoveryRef = useRef(recovery);
  const recoverySessionRef = useRef<AuthSession | null>(null);
  const passwordUpdatedRef = useRef(false);
  const recoveryPlatformReleasedRef = useRef(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  const changeRecovery = useCallback((next: RecoveryState) => {
    recoveryRef.current = next;
    setRecovery(next);
  }, []);

  const acceptRecovery = useCallback((session: AuthSession | null) => {
    recoverySessionRef.current = session;
    changeRecovery(session ? "ready" : "invalid");
    setAcceptedAuthSession(null);
    authSessionRef.current = null;
    confirmedProfileRef.current = null;
    setProfile(null);
    setStatus("anonymous");
    setMessage(session ? null : "恢复链接已过期或已使用，请重新申请恢复邮件。");
    const url = new URL(window.location.href);
    url.searchParams.set("auth", "recovery");
    url.hash = "";
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, [changeRecovery]);

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
    if (recoveryRef.current !== "none") return;
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
      if (recoveryRef.current !== "none") return;
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
        if (recoveryRef.current !== "none") return;
        acceptSiteSession(claimed.sessionId, claimed.profile);
      } else {
        setMessage("另一台设备已继续。本地内容仍保留，云端写入已停止。");
        setStatus(resolution);
      }
    } catch (error) {
      if (recoveryRef.current !== "none") return;
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
        if (recoveryRef.current !== "none") {
          acceptRecovery(null);
          setMessage("登录服务尚未配置，请稍后重新打开邮件链接。");
        }
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
        if (event === "PASSWORD_RECOVERY") { acceptRecovery(session); return; }
        if (recoveryRef.current !== "none") {
          if (session) recoverySessionRef.current = session;
          return;
        }
        if (!interactiveAuthRef.current) void enqueueAuthSession(session, false, event === "SIGNED_OUT");
      });
      try {
        const session = await gateway.getSession();
        if (cancelled) return;
        if (recoveryRef.current === "loading") acceptRecovery(session);
        else if (recoveryRef.current === "none") await enqueueAuthSession(session);
      } catch (error) {
        if (cancelled) return;
        if (recoveryRef.current !== "none") acceptRecovery(null);
        else throw error;
      }
    }).catch((error) => {
      if (cancelled) return;
      setAuthAvailable(false);
      if (recoveryRef.current !== "none") {
        acceptRecovery(null);
        setMessage("登录服务暂不可用，请稍后重新打开邮件链接。");
      } else setMessage(`登录服务暂不可用：${errorMessage(error)}`);
      setStatus("anonymous");
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [acceptRecovery, api, enqueueAuthSession, gatewayFactory]);

  useEffect(() => {
    const shareSessionAcrossTabs = (event: StorageEvent) => {
      if (recoveryRef.current !== "none") return;
      if (event.key !== siteSessionStorageKey || !event.newValue || !authSessionRef.current) return;
      const session = authSessionRef.current;
      void api.loadProfile(session.accessToken, event.newValue)
        .then(({ profile: sharedProfile }) => {
          if (recoveryRef.current === "none" && authSessionRef.current === session && readSiteSession() === event.newValue) acceptSiteSession(event.newValue!, sharedProfile);
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

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!gatewayRef.current || interactiveAuthRef.current) return;
    interactiveAuthRef.current = true;
    setRecoveryBusy(true);
    setMessage(null);
    try {
      await gatewayRef.current.requestPasswordReset(email.trim(), passwordRecoveryRedirect(window.location.origin, basePath));
      setMessage("如果该邮箱已注册，我们会向它发送恢复邮件。请检查收件箱和垃圾邮件。");
    } catch (error) {
      setMessage(recoveryErrorMessage(error));
    } finally {
      interactiveAuthRef.current = false;
      setRecoveryBusy(false);
    }
  }, [basePath]);

  const cancelRecovery = useCallback(async () => {
    if (interactiveAuthRef.current) return;
    interactiveAuthRef.current = true;
    try {
      await gatewayRef.current?.signOut();
      clearPasswordRecoveryUrl();
      changeRecovery("none");
      recoverySessionRef.current = null;
      passwordUpdatedRef.current = false;
      recoveryPlatformReleasedRef.current = false;
      clearSiteSession();
      siteSessionRef.current = null;
      setAcceptedSiteSessionId(null);
      setMessage(null);
      setStatus("anonymous");
    } catch (error) {
      setMessage(recoveryErrorMessage(error));
    } finally { interactiveAuthRef.current = false; }
  }, [changeRecovery]);

  const resetPassword = useCallback(async (password: string) => {
    const gateway = gatewayRef.current;
    if (!gateway || !recoverySessionRef.current || interactiveAuthRef.current) return;
    if (!passwordUpdatedRef.current && password.length < 6) { setMessage("密码至少需要 6 个字符。"); return; }
    interactiveAuthRef.current = true;
    setRecoveryBusy(true);
    setMessage(null);
    try {
      if (!passwordUpdatedRef.current) {
        await gateway.updatePassword(password);
        passwordUpdatedRef.current = true;
        changeRecovery("finishing");
      }
      if (!recoveryPlatformReleasedRef.current) {
        const session = await gateway.getSession();
        if (!session) throw new Error("Missing recovery session");
        // 强制生成新平台会话，使旧设备立即失去云端访问；不触碰账号数据。
        const claimed = await api.claimSession(session.accessToken, null, true);
        await api.releaseSession(session.accessToken, claimed.sessionId);
        recoveryPlatformReleasedRef.current = true;
      }
      await gateway.signOut("global");
      clearSiteSession();
      siteSessionRef.current = null;
      setAcceptedSiteSessionId(null);
      recoverySessionRef.current = null;
      passwordUpdatedRef.current = false;
      recoveryPlatformReleasedRef.current = false;
      clearPasswordRecoveryUrl();
      changeRecovery("none");
      setMessage("密码已重置，旧设备云端会话已失效。请使用新密码登录；本地存档仍保留。");
      setStatus("anonymous");
    } catch (error) {
      setMessage(passwordUpdatedRef.current
        ? "密码已修改，但退出旧会话尚未完成。请重试完成退出。"
        : recoveryErrorMessage(error));
    } finally {
      interactiveAuthRef.current = false;
      setRecoveryBusy(false);
    }
  }, [api, changeRecovery]);

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
    recovery,
    recoveryBusy,
    requestPasswordReset,
    resetPassword,
    cancelRecovery,
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
    recovery,
    recoveryBusy,
    requestPasswordReset,
    resetPassword,
    cancelRecovery,
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
