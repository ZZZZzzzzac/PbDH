const publicationMessages: Record<string, string> = {
  AUTH_REQUIRED: "请先登录，再发布到资源市场。",
  "publication.auth.required": "请先登录，再发布到资源市场。",
  AUTH_SESSION_REPLACED: "当前设备的账号会话已失效，请在账号菜单中重新接管。",
  PUBLICATION_VERSION_CONFLICT: "当前内容与已发布版本不同，请重新发布开发中的 1.0.0。",
  PACKAGE_ID_OWNED_BY_ANOTHER_ACCOUNT: "该资源包 ID 已由其他账号发布。",
  PUBLICATION_CANDIDATE_INVALID: "资源包未通过发布校验，请检查内容后重试。",
  PUBLICATION_REQUEST_FAILED: "发布失败，请稍后重试。",
  "creator.market-handoff.snapshot-mismatch": "市场资源包版本校验失败，请返回资源市场后重试。",
  "creator.market-handoff.request-failed": "无法从资源市场取得资源包，请确认服务已启动后重试。",
};

export function publicationSuccessMessage(
  packageName: string,
  outcome: { created: boolean; idempotent: boolean },
): string {
  if (outcome.idempotent) return `发布内容与已有“${packageName}”完全一致，已跳过`;
  if (outcome.created) return `已发布“${packageName}”`;
  return `已更新已有的“${packageName}”`;
}

export function publicationErrorMessage(code: string, fallback?: string): string {
  return publicationMessages[code] ?? fallback ?? "发布失败，请检查资源包后重试。";
}
