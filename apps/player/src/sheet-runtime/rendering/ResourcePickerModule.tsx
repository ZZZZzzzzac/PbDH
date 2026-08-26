import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { findResourceLibrary, getOtherResourceLibraries, getResourcePickerLinks, type ResourcePickerModule as ResourcePickerModuleConfig, type SystemPackage } from "../domain/systemPackage";
import { getResourceLibraryFields, type ResourceLibraryEntry, type ResourceLibraryQuery } from "../domain/resourceLibrary";
import { useRuntimeStore } from "../store/runtimeStore";
import { ResourceLibraryBrowser } from "./ResourceLibraryBrowser";

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
    return library ? [{ link, library }] : [];
  }), [links, systemPackage]);
  const [selectedLibraryId, setSelectedLibraryId] = useState(availableLibraries[0]?.library.ID ?? "");
  const [queriesByLibrary, setQueriesByLibrary] = useState<Record<string, ResourceLibraryQuery>>({});
  const active = availableLibraries.find(({ library }) => library.ID === selectedLibraryId) ?? availableLibraries[0];
  const library = active?.library;
  const commitResourceSelection = useRuntimeStore((state) => state.commitResourceSelection);
  const runtimeDefaultQuery = useRuntimeStore((state) => state.resourcePickerDefaultQueries[module.ID]);
  const browserFields = useMemo(() => (library ? getResourceLibraryFields(library, active?.link.字段模板) : []), [active?.link.字段模板, library]);
  const defaultQuery = useMemo(
    () => mergeResourcePickerQuery(queriesByLibrary[library?.ID ?? ""] ?? active?.link.默认查询, runtimeDefaultQuery),
    [active?.link.默认查询, library?.ID, queriesByLibrary, runtimeDefaultQuery],
  );

  useEffect(() => {
    if (!availableLibraries.some(({ library: candidate }) => candidate.ID === selectedLibraryId)) {
      setSelectedLibraryId(availableLibraries[0]?.library.ID ?? "");
    }
  }, [availableLibraries, selectedLibraryId]);

  const closeBrowser = () => {
    setQueriesByLibrary({});
    setOpen(false);
  };

  const commitSelection = (entries: ResourceLibraryEntry[]) => {
    if (!library) {
      return;
    }

    commitResourceSelection(module.ID, library.ID, entries);
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
