import type { ReactNode } from "react";

import type { SurfaceResource } from "@pbdh/resource-renderer/core";
import { visibleTabletopResource, type TabletopCommand, type TabletopInstance } from "@pbdh/tabletop/core";
import { CanonicalCardSurface, resolveTemplateFrontend } from "@pbdh/templates/frontend/lazy";

export function GmTabletopCard({
  instance,
  assetUrls,
  onCommand,
}: {
  instance: TabletopInstance;
  assetUrls: ReadonlyMap<string, string>;
  onCommand(command: TabletopCommand): void;
}): ReactNode {
  const displayResource = visibleTabletopResource(instance);
  const assets = new Map(Object.values(displayResource.media).flatMap((id) => {
    const url = assetUrls.get(id);
    return url ? [[id, { status: "ready" as const, url }] as const] : [];
  }));

  const frontend = resolveTemplateFrontend(
    displayResource.template.id,
    displayResource.template.version,
  );
  if (frontend) return <CanonicalCardSurface
    resource={displayResource as unknown as SurfaceResource<Record<string, unknown>>}
    assets={assets}
    state={instance.state}
    onStateCommand={instance.flipped ? undefined : (commandId, value) => onCommand({
      type: "template-state",
      instanceId: instance.id,
      commandId,
      value,
    })}
    label={`${String((displayResource.data as Record<string, unknown>).名称 ?? "未命名资源")}桌面实例`}
  />;
  return <div className="tabletop-renderer-error">无法呈现卡面</div>;
}
