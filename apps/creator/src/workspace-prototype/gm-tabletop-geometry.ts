import { canonicalCardDesignSize } from "@pbdh/resource-renderer/core";
import { clampTabletopPosition, type TabletopDocumentModel } from "@pbdh/tabletop/core";

export const gmTabletopBaseCardWidth = 250;
export const gmCardPixelsPerDesignUnit = gmTabletopBaseCardWidth / canonicalCardDesignSize.width;

export function containGmTabletopInstances(document: TabletopDocumentModel): TabletopDocumentModel {
  let changed = false;
  const instances = document.instances.map((instance) => {
    const position = clampTabletopPosition(instance, {
      ...document.canvas,
      containment: "full",
      pixelsPerUnit: gmCardPixelsPerDesignUnit,
    }, instance.position);
    if (position.x === instance.position.x && position.y === instance.position.y) return instance;
    changed = true;
    return { ...instance, position };
  });
  return changed ? { ...document, instances } : document;
}
