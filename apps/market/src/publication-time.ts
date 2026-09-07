export function publicationUpdateLabel(updatedAt: string, now = Date.now()): string {
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) return "更新时间未知";
  const minutes = Math.floor(Math.max(0, now - timestamp) / 60_000);
  if (minutes < 1) return "刚刚更新";
  if (minutes < 60) return `${minutes} 分钟前更新`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前更新`;
  return `${Math.floor(hours / 24)} 天前更新`;
}
