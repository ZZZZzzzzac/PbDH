export type RecoveryState = "none" | "loading" | "ready" | "invalid" | "finishing";

// 在身份 SDK 消费 URL 前识别恢复入口，不保存 URL 中的凭据。
export function isPasswordRecoveryUrl(href: string): boolean {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  return url.searchParams.get("auth") === "recovery"
    || hash.get("type") === "recovery"
    || hash.has("error_code") || hash.has("error_description");
}

export function passwordRecoveryRedirect(origin: string, basePath = "/"): string {
  const url = new URL(basePath, origin);
  if (url.origin !== origin) throw new Error("恢复回调必须使用当前站点。");
  url.search = "?auth=recovery";
  url.hash = "";
  return url.href;
}

export function clearPasswordRecoveryUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("auth");
  url.hash = "";
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
}

export function recoveryErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") return "请求过于频繁，请稍后再试。";
  if (code === "weak_password") return "密码强度不足，请使用更长、较难猜测的密码。";
  if (code === "same_password") return "新密码不能与旧密码相同。";
  if (code === "otp_expired" || code === "session_not_found" || code === "refresh_token_not_found") return "恢复链接已过期或已使用，请重新申请恢复邮件。";
  return "请求未完成，请检查网络后重试。若恢复链接已失效，请重新申请邮件。";
}
