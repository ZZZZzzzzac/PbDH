import type { PlatformCredentials } from "@pbdh/platform-auth/provider";
import {
  createPbresCandidateValidator,
  createResourceConversionRegistry,
  type ExportOptions,
  type ExportResult,
  type ResourceFormatId,
} from "@pbdh/resource-conversion";
import { loadTemplateCore } from "@pbdh/templates/core/lazy";

import { loadPublicationArchive } from "./market-api.ts";
import type { Publication } from "./market-model.ts";

export type MarketExportTarget = {
  id: string;
  label: string;
  formatId: Exclude<ResourceFormatId, "pbres">;
  dhsheetContent?: ExportOptions["dhsheetContent"];
};

export const marketExportTargets: readonly MarketExportTarget[] = [
  { id: "dhsheet-cards", label: "dhcb 卡牌包", formatId: "dhsheet", dhsheetContent: "cards" },
  { id: "dhsheet-equipment", label: "dhcb 装备包", formatId: "dhsheet", dhsheetContent: "equipment" },
  { id: "zzz", label: "ZZZ 格式", formatId: "zzz" },
  { id: "rinkcx", label: "Rink 格式", formatId: "rinkcx" },
  { id: "kid", label: "不咕鸟格式", formatId: "kid" },
];

const registry = createResourceConversionRegistry(createPbresCandidateValidator(loadTemplateCore));

export async function exportMarketPublication(
  publication: Pick<Publication, "id" | "archiveName" | "author">,
  target: MarketExportTarget,
  credentials: PlatformCredentials | null,
  fetcher: typeof fetch = fetch,
): Promise<ExportResult> {
  const archive = await loadPublicationArchive(publication.id, credentials, fetcher);
  const imported = await registry.import("pbres", {
    bytes: new Uint8Array(await archive.arrayBuffer()),
    fileName: publication.archiveName,
    container: "pbres",
  });
  if (!imported.ok) return { ok: false, report: imported.report };
  const exported = await registry.export(target.formatId, imported.batch, {
    dhsheetContent: target.dhsheetContent,
    packageName: imported.batch.name,
    packageVersion: imported.batch.version,
    // 署名沿用市场作者，不使用下载者的账号。
    creator: publication.author || "未署名",
    owner: publication.author || "未署名",
  });
  return {
    ...exported,
    report: { ...exported.report, diagnostics: [...imported.report.diagnostics, ...exported.report.diagnostics] },
  };
}
