import type { AuthConfig, SessionResolution, SessionStatus } from "./types.ts";

export function isAuthConfigured(
  config: AuthConfig,
): config is Required<Pick<AuthConfig, "configured" | "supabaseUrl" | "supabaseAnonKey">> {
  return config.configured && Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

export function resolveSessionStatus(
  status: SessionStatus,
  currentSessionId: string | null,
): SessionResolution {
  if (status.currentSessionActive && currentSessionId) return "acceptCurrent";
  if (!status.replacementRequired) return "claim";
  return currentSessionId ? "replaced" : "replacementRequired";
}
export function createAuthSessionResolutionQueue() {
  let tail = Promise.resolve();
  return <T>(resolve: () => Promise<T>): Promise<T> => {
    const current = tail.then(resolve);
    tail = current.then(() => undefined, () => undefined);
    return current;
  };
}
