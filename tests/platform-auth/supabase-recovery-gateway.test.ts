import { expect, test, vi } from "vitest";
const { createClient, auth } = vi.hoisted(() => {
  const auth = {
    initialize: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
  return { auth, createClient: vi.fn(() => ({ auth })) };
});
vi.mock("@supabase/supabase-js", () => ({ createClient }));
import { createSupabaseGateway } from "../../packages/platform-auth/src/core/supabase-gateway.ts";

test("邮件与密码只交给 Supabase，恢复支持跨浏览器 implicit 回调及全局退出", async () => {
  const gateway = await createSupabaseGateway({ supabaseUrl: "https://example.test", supabaseAnonKey: "public-key" });
  await gateway.requestPasswordReset("user@example.test", "https://app.test/?auth=recovery");
  expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("user@example.test", { redirectTo: "https://app.test/?auth=recovery" });
  await gateway.updatePassword("new-password");
  expect(auth.updateUser).toHaveBeenCalledWith({ password: "new-password" });
  await gateway.signOut("global");
  expect(auth.signOut).toHaveBeenLastCalledWith({ scope: "global" });
  await gateway.signOut();
  expect(auth.signOut).toHaveBeenLastCalledWith({ scope: "local" });
  expect(createClient).toHaveBeenCalledWith("https://example.test", "public-key", expect.objectContaining({ auth: expect.objectContaining({ flowType: "implicit", detectSessionInUrl: true }) }));
  auth.initialize.mockResolvedValueOnce({ error: new Error("expired recovery link") });
  await expect(gateway.getSession()).rejects.toThrow("expired recovery link");
  expect(auth.getSession).not.toHaveBeenCalled();
});
