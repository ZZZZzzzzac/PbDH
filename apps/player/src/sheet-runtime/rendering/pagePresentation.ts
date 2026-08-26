import type { PackagePage } from "../domain/systemPackage";
export const isPageRuntimeVisible = (page: PackagePage, visibility: Record<string, boolean>) => visibility[page.ID] ?? !page.默认隐藏;
export const runtimeVisiblePages = (pages: PackagePage[], visibility: Record<string, boolean>) => pages.filter((page) => isPageRuntimeVisible(page, visibility));
export const printablePages = (pages: PackagePage[], visibility: Record<string, boolean>) => pages.filter((page) => page.打印 ?? isPageRuntimeVisible(page, visibility));
export const resolveCurrentPageId = (pages: PackagePage[], current: string | null) => pages.some((page) => page.ID === current) ? current : (pages[0]?.ID ?? null);
