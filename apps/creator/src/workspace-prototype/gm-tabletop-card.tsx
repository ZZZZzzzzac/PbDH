import type { ReactNode } from "react";

import { CanonicalCardSurface } from "@pbdh/resource-renderer/react";
import type { SurfaceResource } from "@pbdh/resource-renderer/core";
import type { TabletopCommand, TabletopInstance } from "@pbdh/tabletop/core";
import {
  adversaryRendererFor,
  armorRendererFor,
  environmentRendererFor,
  trustedRendererFor,
  weaponRendererFor,
} from "@pbdh/templates/frontend";
import {
  adversaryTemplate,
  armorTemplate,
  environmentTemplate,
  weaponTemplate,
  type AdversaryData,
  type ArmorData,
  type EnvironmentData,
  type WeaponData,
} from "@pbdh/templates/core";

export function GmTabletopCard({
  instance,
  assetUrls,
  onCommand,
}: {
  instance: TabletopInstance;
  assetUrls: ReadonlyMap<string, string>;
  onCommand(command: TabletopCommand): void;
}): ReactNode {
  const displayResource = instance.flipped && instance.resource.media.back
    ? {
        ...instance.resource,
        presentation: { ...instance.resource.presentation, mode: "image" as const },
        media: { ...instance.resource.media, portrait: instance.resource.media.back },
      }
    : instance.resource;
  const assets = new Map(Object.values(displayResource.media).flatMap((id) => {
    const url = assetUrls.get(id);
    return url ? [[id, { status: "ready" as const, url }] as const] : [];
  }));

  if (displayResource.template.id === adversaryTemplate.id) {
    return <CanonicalCardSurface
      resource={displayResource as TabletopInstance["resource"] & { data: AdversaryData }}
      expectedRendererRevision={adversaryTemplate.rendererRevision}
      renderer={adversaryRendererFor(instance.resource.template.version)}
      assets={assets}
      state={instance.state}
      onStateCommand={(commandId, value) => onCommand({
        type: "template-state",
        instanceId: instance.id,
        commandId,
        value,
      })}
      label={`${(displayResource.data as AdversaryData).名称}桌面实例`}
    />;
  }
  if (displayResource.template.id === weaponTemplate.id) {
    const renderer = weaponRendererFor(instance.resource.template.version);
    return <CanonicalCardSurface
      resource={displayResource as TabletopInstance["resource"] & { data: WeaponData }}
      expectedRendererRevision={renderer.revision}
      renderer={renderer}
      assets={assets}
      state={instance.state}
      label={`${(displayResource.data as WeaponData).名称}桌面实例`}
    />;
  }
  if (displayResource.template.id === armorTemplate.id) {
    return <CanonicalCardSurface
      resource={displayResource as TabletopInstance["resource"] & { data: ArmorData }}
      expectedRendererRevision={armorTemplate.rendererRevision}
      renderer={armorRendererFor(instance.resource.template.version)}
      assets={assets}
      state={instance.state}
      label={`${(displayResource.data as ArmorData).名称}桌面实例`}
    />;
  }
  if (displayResource.template.id === environmentTemplate.id) {
    return <CanonicalCardSurface
      resource={displayResource as TabletopInstance["resource"] & { data: EnvironmentData }}
      expectedRendererRevision={environmentTemplate.rendererRevision}
      renderer={environmentRendererFor(instance.resource.template.version)}
      assets={assets}
      state={instance.state}
      label={`${(displayResource.data as EnvironmentData).名称}桌面实例`}
    />;
  }
  const renderer = trustedRendererFor(displayResource.template.id, displayResource.template.version);
  if (renderer) return <CanonicalCardSurface
    resource={displayResource as unknown as SurfaceResource<Record<string, unknown>>}
    expectedRendererRevision={renderer.revision}
    renderer={renderer}
    assets={assets}
    state={instance.state}
    label={`${String((displayResource.data as Record<string, unknown>).名称 ?? "未命名资源")}桌面实例`}
  />;
  return <div className="tabletop-renderer-error">无法呈现卡面</div>;
}
