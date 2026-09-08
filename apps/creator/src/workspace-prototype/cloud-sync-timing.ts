export function scheduleCreatorCloudSync(sync: () => void): () => void {
  const timer = setTimeout(sync, 10_000);
  return () => clearTimeout(timer);
}
