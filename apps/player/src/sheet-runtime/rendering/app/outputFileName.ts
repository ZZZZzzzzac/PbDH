export function sanitizeFileName(name: string, fallback = "character"): string {
  const safe = name.trim().replace(/[<>:"/\\|?*]/g, "_");
  return safe || fallback;
}

export function normalizeCharacterFormatName(name: string): string {
  return name.trim().replace(/(?:\s+format|格式)$/iu, "").trim();
}

export function buildOutputFileName(saveName: string, extension: string, targetFormat?: string): string {
  const baseName = sanitizeFileName(saveName);
  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;
  const formatName = targetFormat ? normalizeCharacterFormatName(targetFormat) : "";
  const formatSuffix = formatName ? `.${sanitizeFileName(formatName, "format")}` : "";
  return `${baseName}${formatSuffix}${normalizedExtension}`;
}
