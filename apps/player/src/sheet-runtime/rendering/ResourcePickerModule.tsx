import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { findResourceLibrary, getOtherResourceLibraries, getResourcePickerLinks, type ResourcePickerModule as ResourcePickerModuleConfig, type SystemPackage } from "../domain/systemPackage";
import { getOtherResourceLibraryViews, getResourceLibraryFields, type ResourceLibraryEntry, type ResourceLibraryQuery } from "../domain/resourceLibrary";
import { useRuntimeStore } from "../store/runtimeStore";
import { sanitizeResourcePickerQuery } from "../storage/resourcePickerQueryCache";
import { ResourceLibraryBrowser } from "./ResourceLibraryBrowser";
import { useResourcePickerQueryCache } from "./useResourcePickerQueryCache";

interface ResourcePickerModuleProps {
  module: ResourcePickerModuleConfig;
  systemPackage: SystemPackage;
}

export function ResourcePickerModule({ module, systemPackage }: ResourcePickerModuleProps) {
  const [open, setOpen] = useState(false);
  const links = useMemo(() => module.资源库 === "其他"
    ? getOtherResourceLibraries(systemPackage).map((library) => ({ ID: library.ID, 字段模板: undefined, 默认查询: undefined }))
    : getResourcePickerLinks(module), [module, systemPackage]);
  const availableLibraries = useMemo(() => links.flatMap((link) => {
    const library = findResourceLibrary(systemPackage, link.ID);
    if (!library) return [];
    return module.资源库 === "其他"
      ? getOtherResourceLibraryViews(library).map((view) => ({ link, library: view }))
      : [{ link, library }];
  }), [links, module.资源库, systemPackage]);
  const [selectedLibraryId, setSelectedLibraryId] = useState(availableLibraries[0]?.library.ID ?? "");
  const activeCharacterSaveId = useRuntimeStore((state) => state.activeCharacterSaveId);
  const { queriesByLibrary, setQueriesByLibrary, persist: persistQueries } = useResourcePickerQueryCache(systemPackage.manifest.ID, activeCharacterSaveId, module.ID);
  const active = availableLibraries.find(({ library }) => library.ID === selectedLibraryId) ?? availableLibraries[0];
  const library = active?.library;
  const commitResourceSelection = useRuntimeStore((state) => state.commitResourceSelection);
  const runtimeDefaultQuery = useRuntimeStore((state) => state.resourcePickerDefaultQueries[module.ID]);
  const browserFields = useMemo(() => {
    if (!library) return [];
    return module.资源库 === "其他"
      ? library.fields
      : getResourceLibraryFields(library, active?.link.字段模板);
  }, [active?.link.字段模板, library, module.资源库]);
  const restoredQuery = useMemo(
    () => (library ? sanitizeResourcePickerQuery(queriesByLibrary[library.ID], library, browserFields) : undefined),
    [browserFields, library, queriesByLibrary],
  );
  const defaultQuery = useMemo(
    () => mergeResourcePickerQuery(restoredQuery ?? active?.link.默认查询, runtimeDefaultQuery),
    [active?.link.默认查询, restoredQuery, runtimeDefaultQuery],
  );

  useEffect(() => {
    if (!availableLibraries.some(({ library: candidate }) => candidate.ID === selectedLibraryId)) {
      setSelectedLibraryId(availableLibraries[0]?.library.ID ?? "");
    }
  }, [availableLibraries, selectedLibraryId]);

  const closeBrowser = () => {
    // 关闭时立即落盘；筛选、搜索与排序按资源库分别记忆，切表也不会串用。
    persistQueries();
    setOpen(false);
  };

  const commitSelection = (entries: ResourceLibraryEntry[]) => {
    if (!active) {
      return;
    }

    // 分表只影响浏览；建卡仍使用真实资源库 ID，不持久化视图 ID。
    commitResourceSelection(module.ID, active.link.ID, entries);
    closeBrowser();
  };

  return (
    <div className="container resource-picker-module" data-module-id={module.ID} data-module-type={module.类型} data-part="container">
      <button className="icon-button resource-picker-button" data-part="button" type="button" disabled={!library} onClick={() => setOpen(true)}>
        <Search aria-hidden="true" size={18} />
        <span>{library ? module.按钮文本 : "资源库不可用"}</span>
      </button>
      {open && library ? (
        <ResourceLibraryBrowser
          key={library.ID}
          library={library}
          fields={browserFields}
          multiSelect={module.多选 ?? false}
          selectedIds={[]}
          defaultQuery={defaultQuery}
          libraryChoices={availableLibraries.map(({ library: choice }) => ({ ID: choice.ID, 名称: choice.名称 }))}
          onLibraryChange={setSelectedLibraryId}
          onQueryChange={(query) => setQueriesByLibrary((current) => ({ ...current, [library.ID]: query }))}
          onCommit={commitSelection}
          onClose={closeBrowser}
        />
      ) : null}
    </div>
  );
}

function mergeResourcePickerQuery(baseQuery: ResourceLibraryQuery | undefined, runtimeQuery: ResourceLibraryQuery | undefined): ResourceLibraryQuery | undefined {
  if (!baseQuery && !runtimeQuery) {
    return undefined;
  }

  return {
    ...baseQuery,
    ...runtimeQuery,
    filters: {
      ...(baseQuery?.filters ?? {}),
      ...(runtimeQuery?.filters ?? {}),
    },
    sort: runtimeQuery?.sort ?? baseQuery?.sort,
  };
}
