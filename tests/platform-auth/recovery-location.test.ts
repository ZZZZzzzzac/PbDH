import { expect, test } from "vitest";
import { isPasswordRecoveryUrl, passwordRecoveryRedirect } from "../../packages/platform-auth/src/core/password-recovery.ts";

test("恢复回调使用部署子目录，并拒绝跨站地址", () => {
  expect(passwordRecoveryRedirect("https://daggerheart.cn", "/pbdh/")).toBe("https://daggerheart.cn/pbdh/?auth=recovery");
  expect(passwordRecoveryRedirect("http://localhost:5173")).toBe("http://localhost:5173/?auth=recovery");
  expect(() => passwordRecoveryRedirect("https://daggerheart.cn", "https://other.test/")).toThrow();
});

test("识别应用入口、控制台恢复回调和失效邮件，不误判普通链接", () => {
  expect(isPasswordRecoveryUrl("https://example.test/pbdh/?auth=recovery")).toBe(true);
  expect(isPasswordRecoveryUrl("https://example.test/pbdh/#type=recovery&access_token=test")).toBe(true);
  expect(isPasswordRecoveryUrl("https://example.test/pbdh/#error_code=otp_expired")).toBe(true);
  expect(isPasswordRecoveryUrl("https://example.test/pbdh/player")).toBe(false);
});
