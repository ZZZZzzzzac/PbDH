// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { AccountControl, AuthProvider } from "@pbdh/platform-auth/provider";
import { createAuthApi, type AuthGateway } from "@pbdh/platform-auth/core";
import { TutorialEntry } from "../../packages/platform-ui/src/TutorialDialog.tsx";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  window.history.replaceState(null, "", "/");
  localStorage.clear();
  vi.unstubAllGlobals();
});

async function mount(recovering = false) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  if (recovering) window.history.replaceState(null, "", "/?auth=recovery");
  const gateway: AuthGateway = {
    getSession: async () => recovering ? { accessToken: "test-recovery-token" } : null,
    onAuthStateChange: () => () => {},
    signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(),
    requestPasswordReset: vi.fn(), updatePassword: vi.fn(),
  };
  const api = {
    ...createAuthApi(vi.fn()),
    loadConfig: async () => ({ configured: true, supabaseUrl: "https://example.test", supabaseAnonKey: "public-test-key" }),
    claimSession: vi.fn().mockResolvedValue({ sessionId: "new-session" }),
    releaseSession: vi.fn().mockResolvedValue({ released: true }),
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  await act(async () => root.render(<AuthProvider gatewayFactory={() => gateway} api={api}><AccountControl />{recovering && <TutorialEntry />}</AuthProvider>));
  return { container, gateway };
}

async function click(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent === label || item.getAttribute("aria-label") === label);
  expect(button, label).toBeDefined();
  await act(async () => button!.click());
}

async function fill(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

test("登录窗口可申请恢复邮件，忘记密码表单不要求旧密码", async () => {
  const { container, gateway } = await mount();
  await click(container, "账号");
  await click(container, "忘记密码？");
  expect(container.querySelector('input[type="password"]')).toBeNull();
  await fill(container.querySelector<HTMLInputElement>('input[type="email"]')!, "test@example.test");
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(gateway.requestPasswordReset).toHaveBeenCalledExactlyOnceWith("test@example.test", `${window.location.origin}/?auth=recovery`);
  expect(container.textContent).toContain("如果该邮箱已注册");
});

test("恢复窗口自动打开且不被欢迎窗口覆盖，密码不一致不可提交", async () => {
  const { container, gateway } = await mount(true);
  expect(container.textContent).toContain("设置新密码");
  expect(document.querySelector(".pbdh-tutorial-dialog")).toBeNull();
  const inputs = container.querySelectorAll<HTMLInputElement>('input[type="password"]');
  await fill(inputs[0]!, "new-password");
  await fill(inputs[1]!, "different-password");
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(gateway.updatePassword).not.toHaveBeenCalled();
  expect(container.textContent).toContain("两次输入的密码不一致");
  await fill(inputs[1]!, "new-password");
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(gateway.updatePassword).toHaveBeenCalledExactlyOnceWith("new-password");
  expect(container.textContent).toContain("密码已重置");
  expect(container.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe("");
});
