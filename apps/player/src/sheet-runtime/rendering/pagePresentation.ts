import type { PackagePage } from "../domain/systemPackage";
export const isPageRuntimeVisible = (page: PackagePage, visibility: Record<string, boolean>) => visibility[page.ID] ?? !page.默认隐藏;
export const runtimeVisiblePages = (pages: PackagePage[], visibility: Record<string, boolean>) => pages.filter((page) => isPageRuntimeVisible(page, visibility));
export const printablePages = (pages: PackagePage[], visibility: Record<string, boolean>) => pages.filter((page) => page.打印 ?? isPageRuntimeVisible(page, visibility));
export const resolveCurrentPageId = (pages: PackagePage[], current: string | null) => pages.some((page) => page.ID === current) ? current : (pages[0]?.ID ?? null);

const pagePreferencePrefix = "pbdh:player:last-page:";

export function loadPagePreference(
  storage: Pick<Storage, "getItem"> | undefined,
  packageId: string,
  characterSaveId: string | null,
): string | null {
  if (!storage || !characterSaveId) return null;
  return storage.getItem(`${pagePreferencePrefix}${packageId}:${characterSaveId}`);
}

export function savePagePreference(
  storage: Pick<Storage, "setItem"> | undefined,
  packageId: string,
  characterSaveId: string | null,
  pageId: string,
): void {
  if (!storage || !characterSaveId) return;
  storage.setItem(`${pagePreferencePrefix}${packageId}:${characterSaveId}`, pageId);
}
