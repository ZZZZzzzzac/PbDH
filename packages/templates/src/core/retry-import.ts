type FailedImport = { url: string; attempt: number };
const failures = new Map<string, FailedImport>();

function failedModuleUrl(error: unknown): string | undefined {
  if (!(error instanceof TypeError)) return undefined;
  const match = error.message.match(/^Failed to fetch dynamically imported module: (https?:\/\/\S+)$/);
  if (!match) return undefined;
  const url = new URL(match[1]!);
  const owner = new URL(import.meta.url);
  // 只重试同一构建目录内的可信 JS 制品，不能把错误文案变成任意代码入口。
  if (url.origin !== owner.origin || !url.pathname.endsWith(".js")
    || url.pathname.slice(0, url.pathname.lastIndexOf("/") + 1) !== owner.pathname.slice(0, owner.pathname.lastIndexOf("/") + 1)) return undefined;
  return url.href;
}

export async function retryTemplateImport<T>(key: string, load: () => Promise<T>): Promise<T> {
  const failed = failures.get(key);
  try {
    if (!failed) return await load();
    const url = new URL(failed.url);
    url.searchParams.set("pbdh-retry", String(++failed.attempt));
    // 浏览器的失败模块缓存不能由 Promise 缓存清除；只给失败入口增加请求编号。
    return await import(/* @vite-ignore */ url.href) as T;
  } catch (error) {
    const url = failedModuleUrl(error);
    if (url) failures.set(key, { url, attempt: failed?.attempt ?? 0 });
    throw error;
  }
}
