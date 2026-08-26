import { Search } from "lucide-react";
import { useState } from "react";
import { getResourceLibraryFields, type ResourceLibraryEntry } from "../domain/resourceLibrary";
import type { ResourceComposerSelections } from "../domain/resourceComposer";
import { findResourceLibrary, type ResourceComposerModule as ResourceComposerModuleConfig, type SystemPackage } from "../domain/systemPackage";
import { useRuntimeStore } from "../store/runtimeStore";
import { ResourceLibraryBrowser } from "./ResourceLibraryBrowser";

export function ResourceComposerModule({ module, systemPackage }: { module: ResourceComposerModuleConfig; systemPackage: SystemPackage }) {
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [selections, setSelections] = useState<ResourceComposerSelections>({});
  const commitResourceComposition = useRuntimeStore((state) => state.commitResourceComposition);
  const activeSlot = activeSlotIndex === null ? undefined : module.来源槽位[activeSlotIndex];
  const activeLibrary = activeSlot ? findResourceLibrary(systemPackage, activeSlot.资源库ID) : undefined;
  const available = module.来源槽位.every((slot) => findResourceLibrary(systemPackage, slot.资源库ID));

  const close = () => {
    setActiveSlotIndex(null);
    setSelections({});
  };

  const selectEntry = (entries: ResourceLibraryEntry[]) => {
    const entry = entries[0];
    if (!activeSlot || activeSlotIndex === null || !entry) return;
    const nextSelections = { ...selections, [activeSlot.ID]: entry };
    const nextSlotIndex = activeSlotIndex + 1;
    if (nextSlotIndex < module.来源槽位.length) {
      setSelections(nextSelections);
      setActiveSlotIndex(nextSlotIndex);
      return;
    }
    commitResourceComposition(module.ID, nextSelections);
    close();
  };

  return (
    <div className="container resource-picker-module" data-module-id={module.ID} data-module-type={module.类型} data-part="container">
      <button className="icon-button resource-picker-button" data-part="button" type="button" disabled={!available} onClick={() => { setSelections({}); setActiveSlotIndex(0); }}>
        <Search aria-hidden="true" size={18} />
        <span>{available ? module.按钮文本 : "资源库不可用"}</span>
      </button>
      {activeSlot && activeLibrary ? (
        <ResourceLibraryBrowser
          library={activeLibrary}
          fields={getResourceLibraryFields(activeLibrary, activeSlot.字段模板)}
          title={`请选择${activeSlot.标签}`}
          multiSelect={false}
          selectedIds={[]}
          onCommit={selectEntry}
          onClose={close}
        />
      ) : null}
    </div>
  );
}
