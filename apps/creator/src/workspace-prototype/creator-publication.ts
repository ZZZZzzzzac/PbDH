import type { ReactNode } from "react";

import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import {
  createBrowserImageAdmission,
  type ImageAdmissionPolicy,
  type ImageCropSelection,
} from "@pbdh/media-admission";
import { renderCanonicalCardCoverToWebp } from "@pbdh/resource-renderer/react";
import type { ManagedAsset, RendererRevisionCapability, SurfaceResource } from "@pbdh/resource-renderer/core";
import { loadTrustedRenderer } from "@pbdh/templates/frontend/lazy";

import type { CreatorWorkspace, WorkspaceResource } from "./workspace-model.ts";

export type PublicationCoverDraft = {
  assetId: string;
  url: string;
  asset?: ResourcePackageLogicalDocument["assets"][number];
  bytes?: Uint8Array;
};

export const publicationLicenses = {
  "public-domain": {
    label: "公有领域",
    declaration: "作者声明该资源属于公有领域。",
  },
  "cc0-1.0": {
    label: "CC0 1.0",
    declaration: "Creative Commons CC0 1.0 Universal",
  },
  "cc-by-4.0": {
    label: "CC BY 4.0",
    declaration: "Creative Commons Attribution 4.0 International",
  },
  "cc-by-sa-4.0": {
    label: "CC BY-SA 4.0",
    declaration: "Creative Commons Attribution-ShareAlike 4.0 International",
  },
  dpcgl: {
    label: "DPCGL",
    declaration: "Darrington Press Community Gaming License (DPCGL)",
  },
  "all-rights-reserved": {
    label: "保留所有权利",
    declaration: "All rights reserved.",
  },
} as const;

export type PublicationLicenseId = keyof typeof publicationLicenses;

export function publicationLicense(
  value: string,
  fallback: ResourcePackageLogicalDocument["license"],
): ResourcePackageLogicalDocument["license"] {
  const normalized = value.trim();
  const known = Object.entries(publicationLicenses).find(([id, license]) => id === normalized || license.label === normalized)?.[1];
  if (known) return { ...known };
  if (fallback.label === normalized) return structuredClone(fallback);
  return { label: normalized, declaration: normalized };
}

const imageAdmission = createBrowserImageAdmission();

export async function imageAsset(file: File, policy: ImageAdmissionPolicy, selection?: ImageCropSelection) {
  const admitted = await imageAdmission.admit(file, policy, selection ? { crop: selection } : undefined);
  const asset = {
    id: admitted.id,
    mediaType: "image/webp" as const,
    byteLength: String(admitted.byteLength),
    width: String(admitted.width),
    height: String(admitted.height),
  };
  return { asset, bytes: admitted.bytes, blob: admitted.blob };
}

export async function publicationRenderer(resource: WorkspaceResource): Promise<{
  expectedRendererRevision: string;
  renderer?: RendererRevisionCapability<any, any, ReactNode>;
}> {
  const renderer = await loadTrustedRenderer(resource.template.id, resource.template.version);
  return { expectedRendererRevision: renderer?.revision ?? "", renderer };
}

async function generatedPublicationCoverForResource(
  workspace: CreatorWorkspace,
  resource: WorkspaceResource,
  binding: Awaited<ReturnType<typeof publicationRenderer>>,
): Promise<PublicationCoverDraft> {
  const assets = new Map<string, ManagedAsset>(await Promise.all(Object.values(resource.media).map(async (assetId) => {
    const bytes = workspace.media.get(assetId);
    if (!bytes) return [assetId, { status: "error" as const, reason: "missing workspace media" }] as const;
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("renderer.cover.media-read-failed")));
      reader.addEventListener("error", () => reject(new Error("renderer.cover.media-read-failed")));
      reader.readAsDataURL(new Blob([buffer], { type: "image/webp" }));
    });
    return [assetId, { status: "ready" as const, url }] as const;
  })));
  const rendered = await renderCanonicalCardCoverToWebp({
    resource: resource as unknown as SurfaceResource<Record<string, unknown>>,
    expectedRendererRevision: binding.expectedRendererRevision,
    renderer: binding.renderer,
    assets,
    label: `${String((resource.data as Record<string, unknown>).名称 ?? "未命名资源")}发布封面`,
  });
  const digestInput = rendered.bytes.buffer.slice(
    rendered.bytes.byteOffset,
    rendered.bytes.byteOffset + rendered.bytes.byteLength,
  ) as ArrayBuffer;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", digestInput));
  const assetId = `sha256:${[...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return {
    assetId,
    url: URL.createObjectURL(rendered.blob),
    asset: {
      id: assetId,
      mediaType: "image/webp",
      byteLength: String(rendered.bytes.byteLength),
      width: String(rendered.width),
      height: String(rendered.height),
    },
    bytes: rendered.bytes,
  };
}

export async function generatedPublicationCover(
  workspace: CreatorWorkspace,
): Promise<PublicationCoverDraft> {
  if (workspace.document.resources.length === 0) {
    throw new Error("creator.publication-cover.resource-missing");
  }
  const bindings = new Map<string, ReturnType<typeof publicationRenderer>>();
  for (const resource of workspace.document.resources as WorkspaceResource[]) {
    try {
      const key = `${resource.template.id}@${resource.template.version}`;
      const binding = bindings.get(key) ?? publicationRenderer(resource);
      bindings.set(key, binding);
      return await generatedPublicationCoverForResource(workspace, resource, await binding);
    } catch {
      // 单张卡不可渲染时继续尝试包内其他资源，封面缺失本身不阻止发布。
    }
  }
  throw new Error("creator.publication-cover.render-failed");
}
