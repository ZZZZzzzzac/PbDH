import { useMemo, useState } from "react";

import type { SystemPackageDocument } from "@pbdh/contract-runtime";

import type { ResourceLibrary } from "../resources/resource-library.ts";
import {
  listResourcePickerCandidates,
  queryResourcePickerCandidates,
  uniqueResourcePickerValues,
  type ResourcePickerCandidate,
  type ResourcePickerQuery,
} from "../resources/resource-picker.ts";

type PickerModule = Extract<SystemPackageDocument["modules"][number], { type: "resourcePicker" }>;

export function ResourcePickerDialog({
  library,
  module,
  error,
  onClose,
  onCommit,
}: {
  library: ResourceLibrary;
  module: PickerModule;
  error?: string;
  onClose: () => void;
  onCommit: (candidate: ResourcePickerCandidate) => void;
}) {
  const candidates = useMemo(
    () => listResourcePickerCandidates(library, module.nativeEntryId),
    [library, module.nativeEntryId],
  );
  const [keywords, setKeywords] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [sort, setSort] = useState<ResourcePickerQuery["sort"]>();
  const rows = queryResourcePickerCandidates(candidates, { keywords, filters, sort });

  function cycleSort(field: string) {
    setSort((current) => current?.field !== field
      ? { field, direction: "asc" }
      : current.direction === "asc"
        ? { field, direction: "desc" }
        : undefined);
  }

  function toggleFilter(field: string, value: string) {
    setFilters((current) => {
      const values = current[field] ?? [];
      const nextValues = values.includes(value)
        ? values.filter((candidate) => candidate !== value)
        : [...values, value];
      if (nextValues.length === 0) {
        const next = { ...current };
        delete next[field];
        return next;
      }
      return { ...current, [field]: nextValues };
    });
  }

  return <div className="player-dialog-backdrop resource-picker-backdrop">
    <section className="player-resource-picker" role="dialog" aria-modal="true" aria-label={module.buttonLabel}>
      <header>
        <h2>{module.buttonLabel}</h2>
        <div className="picker-search"><input type="search" aria-label="搜索资源" placeholder="搜索" value={keywords} onChange={(event) => setKeywords(event.target.value)} /><span>{rows.length} 条</span></div>
        <button aria-label="关闭" onClick={onClose}>×</button>
      </header>
      {error && <div className="picker-error" role="alert">{error}</div>}
      <div className="picker-table-wrap">
        <table>
          <colgroup>{module.columns.map((column) => <col key={column.field} className={`picker-column-${column.width}`} />)}</colgroup>
          <thead><tr>{module.columns.map((column) => <th key={column.field}>
            <div className="picker-column-heading">
              <span>{column.label}</span>
              {column.sortable && <button aria-label={`按${column.label}排序`} onClick={() => cycleSort(column.field)}>{sort?.field === column.field ? sort.direction === "asc" ? "↑" : "↓" : "↕"}</button>}
              {column.filterable && <details>
                <summary aria-label={`筛选${column.label}`}>⌄</summary>
                <div>{uniqueResourcePickerValues(candidates, column.field).map((value) => <label key={value}><input type="checkbox" checked={(filters[column.field] ?? []).includes(value)} onChange={() => toggleFilter(column.field, value)} />{value}</label>)}</div>
              </details>}
            </div>
          </th>)}</tr></thead>
          <tbody>{rows.map((candidate) => <tr key={candidate.key} tabIndex={0} onClick={() => onCommit(candidate)} onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onCommit(candidate);
          }}>{module.columns.map((column) => <td key={column.field}>{candidate.fields[column.field] ?? ""}</td>)}</tr>)}</tbody>
        </table>
        {rows.length === 0 && <p className="picker-empty">无匹配条目</p>}
      </div>
    </section>
  </div>;
}
