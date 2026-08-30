import {
  RESOURCE_PACKAGE_VERSION,
  computeResourcePackageSnapshotDigest,
  type ResourcePackageCandidate,
  type ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";
import {
  mapBatchToRegisteredCandidates,
  type ConversionDiagnostic,
  type TemporaryResourceBatch,
} from "@pbdh/resource-conversion";
import { templateRegistry } from "@pbdh/templates/core";

export type CreatorResourceConversionCandidate = {
  candidate: ResourcePackageCandidate | null;
  diagnostics: ConversionDiagnostic[];
  converted: number;
  skipped: number;
};

export async function materializeCreatorResourceConversion(
  batch: TemporaryResourceBatch,
): Promise<CreatorResourceConversionCandidate> {
  const mapped = mapBatchToRegisteredCandidates(batch.resources);
  const diagnostics = [
    ...mapped.candidates.flatMap((item) => item.diagnostics),
    ...(batch.media.size > 0 ? [{
      code: "creator.resource-conversion.media-unbound",
      severity: "warning" as const,
      message: `${batch.media.size} 个源媒体文件没有可信目标槽位，未写入资源包。`,
    }] : []),
    ...mapped.unmapped.map<ConversionDiagnostic>((item) => ({
      code: "creator.resource-conversion.unmapped",
      severity: "error",
      message: `无法把“${item.name}”映射到可信资源模板。`,
      resourceId: item.sourceId,
    })),
  ];
  if (mapped.candidates.length === 0 || diagnostics.some((item) => item.severity === "error")) {
    return { candidate: null, diagnostics, converted: mapped.candidates.length, skipped: mapped.unmapped.length };
  }

  const document: ResourcePackageLogicalDocument = {
    contractVersion: RESOURCE_PACKAGE_VERSION,
    package: {
      id: uuidV7(),
      version: semverOrDefault(batch.version),
      name: batch.name.trim() || "导入的资源包",
      description: `由 ${batch.sourceDocument.formatId} 第三方资源显式转换生成。`,
    },
    targets: [],
    license: {
      label: "Imported source — verify license",
      declaration: "此资源包由用户提供的第三方文件转换生成；安装或分发前须由用户确认原始内容许可。",
    },
    forkSource: null,
    assets: [],
    resources: mapped.candidates.map((item, index) => {
      const template = templateRegistry.resolve(item.template.id, item.template.version);
      if (!template) throw new Error(`可信资源模板不可用：${item.template.id}@${item.template.version}`);
      return {
        id: uuidV7(),
        path: `${safePathSegment(item.template.id)}/${String(index + 1).padStart(4, "0")}-${safePathSegment(resourceName(item.data))}.json`,
        template: item.template,
        presentation: structuredClone(template.defaultPresentation),
        data: structuredClone(item.data) as ResourcePackageLogicalDocument["resources"][number]["data"],
        media: {},
      };
    }),
    emptyDirectories: [],
    snapshotDigest: `sha256:${"0".repeat(64)}`,
  };
  const media = new Map<string, Uint8Array>();
  document.snapshotDigest = await computeResourcePackageSnapshotDigest(document, media);
  return {
    candidate: { document, media },
    diagnostics,
    converted: mapped.candidates.length,
    skipped: mapped.unmapped.length,
  };
}

function resourceName(data: Record<string, unknown>): string {
  const value = data["名称"];
  return typeof value === "string" && value.trim() ? value : "未命名资源";
}

function safePathSegment(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "-").replace(/[ .]+$/gu, "").slice(0, 80) || "resource";
}

function semverOrDefault(value: string | undefined): string {
  return /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.test(value ?? "")
    ? value!
    : "1.0.0";
}

function uuidV7(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let timestamp = BigInt(Date.now());
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
