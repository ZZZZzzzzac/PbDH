import { createClient } from "@supabase/supabase-js";

import type { AuthGateway, AuthGatewayFactory, AuthSession } from "./types.ts";

export const createSupabaseGateway: AuthGatewayFactory = ({ supabaseUrl, supabaseAnonKey }) => {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "pbdh-platform-supabase-auth",
    },
  });
  const gateway: AuthGateway = {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return mapSession(data.session);
    },
    onAuthStateChange(callback) {
      const { data } = client.auth.onAuthStateChange((_event, session) => callback(mapSession(session)));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error("登录未返回有效会话。");
      return mapSession(data.session)!;
    },
    async signUp(email, password) {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) throw error;
      return mapSession(data.session);
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
    },
  };
  return gateway;
};

function mapSession(session: { access_token: string } | null): AuthSession | null {
  return session ? { accessToken: session.access_token } : null;
}
