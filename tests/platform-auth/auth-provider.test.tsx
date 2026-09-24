// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { AuthProvider, reportPlatformSessionFailure, useAuth, type AuthContextValue } from "@pbdh/platform-auth/provider";
import { AuthApiError, createAuthApi, type AuthGateway, type AuthSession } from "@pbdh/platform-auth/core";
import { HttpCloudDocumentApi } from "@pbdh/cloud-documents";

const profile = { accountId: "test-account", username: "test-user", isAdmin: false };
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function mountAuth(restored = false, overrides: Partial<AuthGateway> = {}) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.setItem("pbdh-platform-site-session", "local-session");
  let owner: string | null = restored ? "local-session" : "other-device";
  let callback: ((session: AuthSession | null, event?: string) => void) | undefined;
  let context!: AuthContextValue;
  let claims = 0;
  const api = {
    ...createAuthApi(vi.fn()),
    loadConfig: vi.fn().mockResolvedValue({ configured: true, supabaseUrl: "https://example.test", supabaseAnonKey: "test-key" }),
    loadSessionStatus: vi.fn(async (_token: string, id?: string | null) => ({
      profile, currentSessionActive: id === owner, replacementRequired: owner !== null && id !== owner,
    })),
    loadProfile: vi.fn().mockResolvedValue({ profile }),
    saveUsername: vi.fn().mockResolvedValue({ profile }),
    releaseSession: vi.fn(async () => { owner = null; return { released: true }; }),
    claimSession: vi.fn(async () => {
      owner = `claimed-${++claims}`;
      return { sessionId: owner, profile, replacedExisting: true };
    }),
  };
  const gateway: AuthGateway = {
    getSession: async () => restored ? { accessToken: "test-token" } : null,
    onAuthStateChange: (next) => { callback = next; return () => { callback = undefined; }; },
    signIn: async () => { const session = { accessToken: "test-token" }; callback?.(session); return session; },
    signUp: async () => null,
    signOut: async () => { callback?.(null); },
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  function Probe() { context = useAuth(); return <output>{context.status}</output>; }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  await act(async () => root.render(<AuthProvider api={api} gatewayFactory={() => gateway}><Probe /></AuthProvider>));
  return { api, gateway, read: () => context, emit: (session: AuthSession | null, event?: string) => callback?.(session, event), replaceOwner: () => { owner = "other-device"; } };
}

test("恢复事件禁用云凭据，不认领旧会话，并优先于后续恢复通知", async () => {
  const auth = await mountAuth(true);
  auth.api.loadSessionStatus.mockClear();
  await act(async () => auth.emit({ accessToken: "recovery-token" }, "PASSWORD_RECOVERY"));
  await act(async () => auth.emit({ accessToken: "recovery-token" }, "INITIAL_SESSION"));
  expect(auth.read().recovery).toBe("ready");
  expect(auth.read().credentials).toBeNull();
  expect(auth.api.loadSessionStatus).not.toHaveBeenCalled();
  expect(auth.api.claimSession).not.toHaveBeenCalled();
});

test("恢复回调刷新及 SDK 早期事件丢失时仍显示新密码窗口", async () => {
  window.history.replaceState(null, "", "/?auth=recovery#type=recovery&access_token=test-only");
  const auth = await mountAuth(true);
  expect(auth.read().recovery).toBe("ready");
  expect(auth.api.loadSessionStatus).not.toHaveBeenCalled();
  expect(window.location.hash).toBe("");
});

test("过期恢复链接不回退成已有账号登录，也不暴露上游错误", async () => {
  window.history.replaceState(null, "", "/?auth=recovery#error_code=otp_expired");
  const auth = await mountAuth(true, { getSession: async () => { throw new Error("private upstream details"); } });
  expect(auth.read().recovery).toBe("invalid");
  expect(auth.read().credentials).toBeNull();
  expect(auth.read().message).toContain("过期");
  expect(auth.read().message).not.toContain("private");
});

test("密码更新后强制替换并释放平台会话，全局退出后要求重新登录且保留本地数据", async () => {
  const signOut = vi.fn().mockResolvedValue(undefined);
  const auth = await mountAuth(true, { signOut });
  localStorage.setItem("unrelated-local-document", "keep");
  await act(async () => auth.emit({ accessToken: "recovery-token" }, "PASSWORD_RECOVERY"));
  await act(async () => auth.read().resetPassword("new-password"));
  expect(auth.gateway.updatePassword).toHaveBeenCalledExactlyOnceWith("new-password");
  expect(auth.api.claimSession).toHaveBeenCalledExactlyOnceWith("test-token", null, true);
  expect(auth.api.releaseSession).toHaveBeenCalledExactlyOnceWith("test-token", "claimed-1");
  expect(signOut).toHaveBeenCalledExactlyOnceWith("global");
  expect(auth.read().status).toBe("anonymous");
  expect(auth.read().recovery).toBe("none");
  expect(auth.read().message).toContain("密码已重置");
  expect(localStorage.getItem("pbdh-platform-site-session")).toBeNull();
  expect(localStorage.getItem("unrelated-local-document")).toBe("keep");
});

test("退出旧会话失败保留重试入口，不重复提交已修改的密码", async () => {
  const signOut = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue(undefined);
  const auth = await mountAuth(true, { signOut });
  await act(async () => auth.emit({ accessToken: "recovery-token" }, "PASSWORD_RECOVERY"));
  await act(async () => auth.read().resetPassword("new-password"));
  expect(auth.read().recovery).toBe("finishing");
  expect(auth.read().credentials).toBeNull();
  await act(async () => auth.read().resetPassword(""));
  expect(auth.gateway.updatePassword).toHaveBeenCalledOnce();
  expect(auth.api.claimSession).toHaveBeenCalledOnce();
  expect(auth.read().recovery).toBe("none");
});

test("恢复邮件请求使用当前网站回调，不泄漏邮箱是否注册或上游异常", async () => {
  const requestPasswordReset = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("user does not exist"));
  const auth = await mountAuth(false, { requestPasswordReset });
  await act(async () => auth.read().requestPasswordReset(" user@example.test "));
  expect(requestPasswordReset).toHaveBeenCalledExactlyOnceWith("user@example.test", `${window.location.origin}/?auth=recovery`);
  expect(auth.read().message).toContain("如果该邮箱已注册");
  await act(async () => auth.read().requestPasswordReset("user@example.test"));
  expect(auth.read().message).not.toContain("does not exist");
});

test("切回标签页的慢恢复和临时网络失败不清空已确认账号", async () => {
  const auth = await mountAuth(true);
  const previous = auth.read().credentials!;
  auth.api.loadSessionStatus.mockClear();
  await act(async () => auth.emit({ accessToken: "test-token" }, "SIGNED_IN"));
  let release!: (value: { profile: typeof profile; currentSessionActive: boolean; replacementRequired: boolean }) => void;
  const pending = new Promise<{ profile: typeof profile; currentSessionActive: boolean; replacementRequired: boolean }>((resolve) => { release = resolve; });
  auth.api.loadSessionStatus.mockReturnValueOnce(pending);
  try {
    await act(async () => auth.emit({ accessToken: "refreshed-token" }, "TOKEN_REFRESHED"));
    expect(auth.read().status).toBe("authenticated");
    expect(auth.read().profile?.accountId).toBe(previous.accountId);
    expect(auth.read().credentials?.accountId).toBe(previous.accountId);
    await act(async () => { release({ profile, currentSessionActive: true, replacementRequired: false }); await pending; });
    expect(auth.read().credentials?.accessToken).toBe("refreshed-token");
    auth.api.loadSessionStatus.mockClear();
    await act(async () => auth.emit({ accessToken: "refreshed-token" }, "SIGNED_IN"));
    expect(auth.api.loadSessionStatus).not.toHaveBeenCalled();
    auth.api.loadSessionStatus.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await act(async () => auth.emit({ accessToken: "next-token" }, "TOKEN_REFRESHED"));
    expect(auth.read().status).toBe("authenticated");
    expect(auth.read().credentials?.accountId).toBe(previous.accountId);
    expect(auth.read().message).toContain("Failed to fetch");
    await act(async () => auth.emit(null, "INITIAL_SESSION"));
    expect(auth.read().credentials?.accountId).toBe(previous.accountId);
    await act(async () => auth.emit(null, "SIGNED_OUT"));
    expect(auth.read().status).toBe("anonymous");
    expect(auth.read().credentials).toBeNull();
  } finally {
    await act(async () => { release({ profile, currentSessionActive: true, replacementRequired: false }); await pending; });
  }
});

test("主动登录直接接管，重复恢复事件不二次认领", async () => {
  const auth = await mountAuth();
  await act(async () => auth.read().signIn("user@example.test", "test-password"));
  expect(auth.api.claimSession).toHaveBeenCalledExactlyOnceWith("test-token", "local-session", true);
  expect(auth.read().status).toBe("authenticated");
  await act(async () => auth.emit({ accessToken: "refreshed-token" }));
  expect(auth.api.claimSession).toHaveBeenCalledOnce();
});

test("后台刷新不抢回失效会话，包括服务器已视为过期的会话", async () => {
  const auth = await mountAuth(true);
  auth.api.loadSessionStatus.mockResolvedValue({ profile, currentSessionActive: false, replacementRequired: false });
  await act(async () => auth.emit({ accessToken: "refreshed-token" }));
  expect(auth.read().status).toBe("replaced");
  expect(auth.api.claimSession).not.toHaveBeenCalled();
});

test("慢刷新不能重新激活已被实际请求确认失效的会话", async () => {
  const auth = await mountAuth(true);
  let release!: (value: { profile: typeof profile; currentSessionActive: boolean; replacementRequired: boolean }) => void;
  const pending = new Promise<{ profile: typeof profile; currentSessionActive: boolean; replacementRequired: boolean }>((resolve) => { release = resolve; });
  auth.api.loadSessionStatus.mockReturnValueOnce(pending);
  await act(async () => auth.emit({ accessToken: "new-token" }, "TOKEN_REFRESHED"));
  await act(async () => auth.read().credentials!.onSessionReplaced!());
  await act(async () => { release({ profile, currentSessionActive: true, replacementRequired: false }); await pending; });
  expect(auth.read().status).toBe("replaced");
  expect(auth.read().credentials?.canWrite).toBe(false);
  expect(auth.api.claimSession).not.toHaveBeenCalled();
});

test("下载失败只在服务端明确报告会话替换时失效且保留响应体", async () => {
  const auth = await mountAuth(true);
  const credentials = auth.read().credentials!;
  await reportPlatformSessionFailure(new Response("Bad Gateway", { status: 502 }), credentials);
  expect(auth.read().status).toBe("authenticated");
  const response = new Response(JSON.stringify({ error: { code: "AUTH_SESSION_REPLACED" } }), { status: 401 });
  await act(async () => reportPlatformSessionFailure(response, credentials));
  expect(auth.read().status).toBe("replaced");
  expect(await response.json()).toEqual({ error: { code: "AUTH_SESSION_REPLACED" } });
});

test("同源标签页共享已确认会话而不再次接管", async () => {
  const auth = await mountAuth(true);
  await act(async () => {
    localStorage.setItem("pbdh-platform-site-session", "shared-session");
    window.dispatchEvent(new StorageEvent("storage", { key: "pbdh-platform-site-session", newValue: "shared-session" }));
  });
  expect(auth.api.loadProfile).toHaveBeenCalledExactlyOnceWith("test-token", "shared-session");
  expect(auth.read().credentials?.siteSessionId).toBe("shared-session");
  expect(auth.api.claimSession).not.toHaveBeenCalled();
});

test("修改用户名遭会话替换拒绝后不能恢复云写入状态", async () => {
  const auth = await mountAuth(true);
  auth.api.saveUsername.mockRejectedValueOnce(new AuthApiError("AUTH_SESSION_REPLACED", "已替换", 401));
  await act(async () => auth.read().updateUsername("next-name"));
  expect(auth.read().status).toBe("replaced");
  expect(auth.read().credentials?.canWrite).toBe(false);
});

test("不轮询；实际云请求触发失效，旧回执不影响新会话", async () => {
  vi.useFakeTimers();
  const auth = await mountAuth(true);
  await act(async () => vi.advanceTimersByTimeAsync(60_000));
  expect(auth.api.loadProfile).not.toHaveBeenCalled();
  const previous = auth.read().credentials!;
  const client = new HttpCloudDocumentApi(vi.fn().mockImplementation(async () => new Response(JSON.stringify({
    error: { code: "AUTH_SESSION_REPLACED", message: "另一设备已接管" },
  }), { status: 401 })));
  await act(async () => {
    await expect(client.listDocuments("character-save", false, previous)).rejects.toMatchObject({ code: "AUTH_SESSION_REPLACED" });
  });
  expect(auth.read().status).toBe("replaced");
  expect(auth.read().credentials?.canWrite).toBe(false);
  auth.replaceOwner();
  await act(async () => auth.read().confirmReplacement());
  const current = auth.read().credentials!;
  expect(current.siteSessionId).not.toBe(previous.siteSessionId);
  await act(async () => {
    await expect(client.listDocuments("character-save", false, previous)).rejects.toMatchObject({ code: "AUTH_SESSION_REPLACED" });
  });
  expect(auth.read().status).toBe("authenticated");
  expect(auth.read().credentials?.siteSessionId).toBe(current.siteSessionId);
});
