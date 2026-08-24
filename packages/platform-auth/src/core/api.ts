import type { AccountProfile, AuthConfig, SessionStatus } from "./types.ts";

export class AuthApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  accessToken?: string;
  sessionId?: string | null;
  body?: unknown;
};

export type AuthApi = ReturnType<typeof createAuthApi>;

export function createAuthApi(fetcher: typeof fetch = fetch, baseUrl = "") {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await fetcher(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
        ...(options.sessionId ? { "X-PbDH-Session": options.sessionId } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    let payload: { error?: { code?: string; message?: string } } & T;
    try {
      payload = JSON.parse(await response.text()) as typeof payload;
    } catch {
      throw new AuthApiError(
        "AUTH_RESPONSE_INVALID",
        "账号服务返回了无效响应，请稍后重试。",
        response.status,
      );
    }
    if (!response.ok) {
      throw new AuthApiError(
        payload.error?.code ?? "AUTH_REQUEST_FAILED",
        payload.error?.message ?? "账号请求失败。",
        response.status,
      );
    }
    return payload;
  }

  return {
    loadConfig: () => request<AuthConfig>("/api/auth/config"),
    loadSessionStatus: (accessToken: string, sessionId: string | null) =>
      request<SessionStatus>("/api/auth/session/status", { accessToken, sessionId }),
    claimSession: (accessToken: string, currentSessionId: string | null, replaceExisting: boolean) =>
      request<{ sessionId: string; profile: AccountProfile; replacedExisting: boolean }>(
        "/api/auth/session/claim",
        { method: "POST", accessToken, body: { currentSessionId, replaceExisting } },
      ),
    loadProfile: (accessToken: string, sessionId: string) =>
      request<{ profile: AccountProfile }>("/api/auth/me", { accessToken, sessionId }),
    saveUsername: (accessToken: string, sessionId: string, username: string) =>
      request<{ profile: AccountProfile }>("/api/auth/profile/username", {
        method: "PUT",
        accessToken,
        sessionId,
        body: { username },
      }),
    releaseSession: (accessToken: string, sessionId: string) =>
      request<{ released: boolean }>("/api/auth/session", {
        method: "DELETE",
        accessToken,
        sessionId,
      }),
  };
}
