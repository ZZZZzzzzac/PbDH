import type { ResourceContainer } from "@pbdh/resource-conversion";

export function resourceContainer(fileName: string): ResourceContainer {
  const extension = fileName.split(".").at(-1)?.toLocaleLowerCase();
  if (extension === "dhcb") return "dhcb";
  if (extension === "zip") return "zip";
  if (extension === "png") return "png";
  return "json";
}

export function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/gu, "-").trim() || "resources";
}

export function downloadBytes(bytes: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function isSemanticVersion(value: string): boolean {
  return /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(value.trim());
}
