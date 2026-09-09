import { describe, expect, it, vi } from "vitest";

import {
  AuthApiError,
  createAuthSessionResolutionQueue,
  createAuthApi,
  isAuthConfigured,
  resolveSessionStatus,
  type AccountProfile,
} from "@pbdh/platform-auth/core";

const profile: AccountProfile = {
  accountId: "account_123",
  username: "牛头人",
  isAdmin: false,
};

describe("platform auth config", () => {
  it("keeps anonymous use available when Supabase is not configured", () => {
    expect(isAuthConfigured({ configured: false })).toBe(false);
    expect(isAuthConfigured({ configured: true, supabaseUrl: "https://example.test" })).toBe(false);
    expect(isAuthConfigured({
      configured: true,
      supabaseUrl: "https://example.test",
      supabaseAnonKey: "anon-key",
    })).toBe(true);
  });
});

describe("platform session resolution", () => {
  it("accepts the active local session", () => {
    expect(resolveSessionStatus({
      profile,
      currentSessionActive: true,
      replacementRequired: false,
    }, "session_current")).toBe("acceptCurrent");
  });

  it("claims an account without an active session", () => {
    expect(resolveSessionStatus({
      profile,
      currentSessionActive: false,
      replacementRequired: false,
    }, null)).toBe("claim");
  });

  it("distinguishes takeover confirmation from a replaced local session", () => {
    const remote = { profile, currentSessionActive: false, replacementRequired: true };
    expect(resolveSessionStatus(remote, null)).toBe("replacementRequired");
    expect(resolveSessionStatus(remote, "session_stale")).toBe("replaced");
  });

  it("requires explicit intent before a known invalid session can reclaim", () => {
    const stale = { profile, currentSessionActive: false, replacementRequired: false };
    expect(resolveSessionStatus(stale, "old-session")).toBe("replaced");
    expect(resolveSessionStatus(stale, "old-session", true)).toBe("claim");
    expect(resolveSessionStatus({ ...stale, replacementRequired: true }, null, true)).toBe("claim");
  });

  it("serializes duplicate auth restoration callbacks", async () => {
    const enqueue = createAuthSessionResolutionQueue();
    const calls: string[] = [];
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => { releaseFirst = resolve; });

    const first = enqueue(async () => {
      calls.push("first:start");
      await firstBlocked;
      calls.push("first:end");
    });
    const second = enqueue(async () => {
      calls.push("second:start");
    });

    await Promise.resolve();
    expect(calls).toEqual(["first:start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(calls).toEqual(["first:start", "first:end", "second:start"]);
  });
});

describe("platform auth API", () => {
  it("sends bearer and site-session headers without a role", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ profile }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const api = createAuthApi(fetcher, "https://api.example.test");

    const result = await api.loadProfile("token-123", "session-123");

    expect(result.profile).toEqual(profile);
    expect(result.profile).not.toHaveProperty("role");
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.example.test/api/auth/me");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token-123");
    expect(new Headers(init?.headers).get("X-PbDH-Session")).toBe("session-123");
  });

  it("sends explicit takeover intent when claiming a session", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      sessionId: "session_new",
      profile,
      replacedExisting: true,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const api = createAuthApi(fetcher);

    await api.claimSession("token-123", "session_old", true);

    const [, init] = fetcher.mock.calls[0]!;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      currentSessionId: "session_old",
      replaceExisting: true,
    });
  });

  it("maps stable backend diagnostics", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "AUTH_SESSION_REPLACED", message: "会话已被替换。" },
    }), { status: 409, headers: { "Content-Type": "application/json" } }));

    await expect(createAuthApi(fetcher).loadProfile("token", "session"))
      .rejects.toEqual(new AuthApiError("AUTH_SESSION_REPLACED", "会话已被替换。", 409));
  });

  it("maps an empty gateway response to a stable Chinese error", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 502 }));

    await expect(createAuthApi(fetcher).loadConfig())
      .rejects.toEqual(new AuthApiError(
        "AUTH_RESPONSE_INVALID",
        "账号服务返回了无效响应，请稍后重试。",
        502,
      ));
  });
});
