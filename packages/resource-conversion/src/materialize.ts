import {
  RESOURCE_PACKAGE_VERSION,
  computeResourcePackageSnapshotDigest,
  type ResourcePackageCandidate,
  type ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";
import { mapBatchToRegisteredCandidates } from "./template-mapping.ts";
import type {
  ConversionDiagnostic,
  ResourceFormatId,
  ResourceMediaNormalizer,
  TemporaryResourceBatch,
} from "./types.ts";

export type ResourceConversionMaterialization = {
  candidate: ResourcePackageCandidate | null;
  diagnostics: ConversionDiagnostic[];
  converted: number;
  skipped: number;
};

export async function materializeResourceConversion(input: {
  batch: TemporaryResourceBatch;
  targets: ResourcePackageLogicalDocument["targets"];
  diagnosticNamespace: string;
  templates: ReadonlyArray<{
    id: string;
    version: string;
    defaultPresentation: ResourcePackageLogicalDocument["resources"][number]["presentation"];
    mediaSlots: ReadonlyArray<{ id: string; accepts: readonly string[] }>;
  }>;
  normalizeMedia?: ResourceMediaNormalizer;
}): Promise<ResourceConversionMaterialization> {
  const mapped = mapBatchToRegisteredCandidates(input.batch.resources);
  const mappedResources = input.batch.resources.filter((resource) => !mapped.unmapped.includes(resource));
  const diagnostics = [
    ...mapped.candidates.flatMap((item) => item.diagnostics),
    ...mapped.unmapped.map<ConversionDiagnostic>((item) => ({
      code: `${input.diagnosticNamespace}.resource-conversion.unmapped`,
      severity: "error",
      message: `无法把“${item.name}”映射到可信资源模板。`,
      resourceId: item.sourceId,
    })),
  ];
  if (mapped.candidates.length === 0 || diagnostics.some((item) => item.severity === "error")) {
    return { candidate: null, diagnostics, converted: mapped.candidates.length, skipped: mapped.unmapped.length };
  }

  const media = new Map<string, Uint8Array>();
  const assets = new Map<string, ResourcePackageLogicalDocument["assets"][number]>();
  const resourceMedia: Array<Record<string, string>> = [];
  const remainingSourceMedia = new Set(input.batch.media.keys());
  const normalizedSourceMedia = new Map<string, ReturnType<ResourceMediaNormalizer>>();
  for (const [index, item] of mapped.candidates.entries()) {
    const source = mappedResources[index]!;
    const template = input.templates.find((candidate) =>
      candidate.id === item.template.id && candidate.version === item.template.version);
    if (!template) throw new Error(`可信资源模板不可用：${item.template.id}@${item.template.version}`);
    const bindings: Record<string, string> = {};
    for (const [slot, sourceKey] of Object.entries(source.media ?? {})) {
      const bytes = input.batch.media.get(sourceKey);
      if (!bytes) {
        diagnostics.push({
          code: `${input.diagnosticNamespace}.resource-conversion.media-missing`,
          severity: "warning",
          message: `“${source.name}”引用的源媒体不存在，未写入资源包。`,
          resourceId: source.sourceId,
          path: sourceKey,
        });
        continue;
      }
      remainingSourceMedia.delete(sourceKey);
      const targetSlot = template.mediaSlots.find((candidate) => candidate.id === slot);
      if (!targetSlot?.accepts.includes("image/webp")) {
        diagnostics.push({
          code: `${input.diagnosticNamespace}.resource-conversion.media-slot-unavailable`,
          severity: "warning",
          message: `“${source.name}”的 ${slot} 媒体没有可信目标槽位，未写入资源包。`,
          resourceId: source.sourceId,
          path: sourceKey,
        });
        continue;
      }
      if (!input.normalizeMedia) {
        diagnostics.push({
          code: `${input.diagnosticNamespace}.resource-conversion.media-normalizer-unavailable`,
          severity: "warning",
          message: `“${source.name}”的源媒体无法通过统一图片流程处理，未写入资源包。`,
          resourceId: source.sourceId,
          path: sourceKey,
        });
        continue;
      }
      try {
        const pending = normalizedSourceMedia.get(sourceKey)
          ?? input.normalizeMedia({ bytes, fileName: sourceKey });
        normalizedSourceMedia.set(sourceKey, pending);
        const normalized = await pending;
        bindings[slot] = normalized.id;
        if (!assets.has(normalized.id)) {
          const copied = normalized.bytes.slice();
          media.set(normalized.id, copied);
          assets.set(normalized.id, {
            id: normalized.id,
            mediaType: normalized.mediaType,
            byteLength: String(normalized.byteLength),
            width: String(normalized.width),
            height: String(normalized.height),
          });
        }
      } catch {
        diagnostics.push({
          code: `${input.diagnosticNamespace}.resource-conversion.media-normalization-failed`,
          severity: "warning",
          message: `“${source.name}”的源媒体无法归一化为 WebP，未写入资源包。`,
          resourceId: source.sourceId,
          path: sourceKey,
        });
      }
    }
    resourceMedia.push(bindings);
  }
  if (remainingSourceMedia.size > 0) diagnostics.push({
    code: `${input.diagnosticNamespace}.resource-conversion.media-unbound`,
    severity: "warning",
    message: `${remainingSourceMedia.size} 个源媒体文件没有可信目标槽位，未写入资源包。`,
  });

  const packageName = input.batch.name.trim() || "导入的资源包";
  const document: ResourcePackageLogicalDocument = {
    contractVersion: RESOURCE_PACKAGE_VERSION,
    package: {
      id: uuidV7(),
      version: semverOrDefault(input.batch.version),
      name: packageName,
      description: `由 ${input.batch.sourceDocument.formatId} 第三方资源显式转换生成。`,
    },
    targets: structuredClone(input.targets),
    license: {
      label: "Imported source — verify license",
      declaration: "此资源包由用户提供的第三方文件转换生成；安装或分发前须由用户确认原始内容许可。",
    },
    forkSource: null,
    assets: [...assets.values()],
    resources: mapped.candidates.map((item, index) => {
      const template = input.templates.find((candidate) =>
        candidate.id === item.template.id && candidate.version === item.template.version);
      if (!template) throw new Error(`可信资源模板不可用：${item.template.id}@${item.template.version}`);
      return {
        id: uuidV7(),
        path: materializedResourcePath(
          input.batch.sourceDocument.formatId,
          item.template.id,
          item.data,
          index,
        ),
        template: item.template,
        presentation: {
          ...structuredClone(template.defaultPresentation),
          ...(resourceMedia[index]?.portrait && template.defaultPresentation.mode === "text" ? { mode: "split" as const } : {}),
        },
        attribution: {
          artworkCredit: "",
          sourceLabel: packageName,
        },
        data: structuredClone(item.data) as ResourcePackageLogicalDocument["resources"][number]["data"],
        media: resourceMedia[index]!,
      };
    }),
    emptyDirectories: [],
    snapshotDigest: `sha256:${"0".repeat(64)}`,
  };
  document.snapshotDigest = await computeResourcePackageSnapshotDigest(document, media);
  return {
    candidate: { document, media },
    diagnostics,
    converted: mapped.candidates.length,
    skipped: mapped.unmapped.length,
  };
}

function materializedResourcePath(
  formatId: ResourceFormatId,
  templateId: string,
  data: Record<string, unknown>,
  index: number,
): string {
  const semanticFolder = formatId === "dhsheet"
    ? templateId === "领域卡"
      ? textField(data, "领域")
      : templateId === "子职业"
        ? textField(data, "主职")
        : ""
    : "";
  return [
    safePathSegment(templateId),
    ...(semanticFolder ? [safePathSegment(semanticFolder)] : []),
    `${String(index + 1).padStart(4, "0")}-${safePathSegment(resourceName(data))}.json`,
  ].join("/");
}

function textField(data: Record<string, unknown>, field: string): string {
  const value = data[field];
  return typeof value === "string" ? value.trim() : "";
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
