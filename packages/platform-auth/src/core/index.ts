export { AuthApiError, createAuthApi, type AuthApi } from "./api.ts";
export { isAuthConfigured, resolveSessionStatus } from "./session.ts";
export { createSupabaseGateway } from "./supabase-gateway.ts";
export type {
  AccountProfile,
  AuthConfig,
  AuthGateway,
  AuthGatewayFactory,
  AuthSession,
  AuthStatus,
  SessionResolution,
  SessionStatus,
} from "./types.ts";
