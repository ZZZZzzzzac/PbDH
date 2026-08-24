export type AuthSession = { accessToken: string };

export type AuthConfig = {
  configured: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

export type AccountProfile = {
  accountId: string;
  username: string | null;
  isAdmin: boolean;
};

export interface AuthGateway {
  getSession(): Promise<AuthSession | null>;
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void;
  signIn(email: string, password: string): Promise<AuthSession>;
  signUp(email: string, password: string): Promise<AuthSession | null>;
  signOut(): Promise<void>;
}

export type AuthGatewayFactory = (
  config: Required<Pick<AuthConfig, "supabaseUrl" | "supabaseAnonKey">>,
) => AuthGateway | Promise<AuthGateway>;

export type AuthStatus =
  | "loading"
  | "anonymous"
  | "working"
  | "replacementRequired"
  | "authenticated"
  | "replaced"
  | "error";

export type SessionStatus = {
  profile: AccountProfile;
  currentSessionActive: boolean;
  replacementRequired: boolean;
};

export type SessionResolution = "acceptCurrent" | "claim" | "replacementRequired" | "replaced";
