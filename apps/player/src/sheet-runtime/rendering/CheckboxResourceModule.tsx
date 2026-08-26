import type { CheckboxResourceModule as CheckboxResourceModuleConfig } from "../domain/systemPackage";
import { useRuntimeStore } from "../store/runtimeStore";
import { readCheckboxState } from "./moduleState";

interface CheckboxResourceModuleProps {
  module: CheckboxResourceModuleConfig;
}

type CheckboxState = Record<string, boolean>;

export function CheckboxResourceModule({ module }: CheckboxResourceModuleProps) {
  const rawValue = useRuntimeStore((state) => state.characterData?.character.values[module.ID]);
  const commitCheckboxChange = useRuntimeStore((state) => state.commitCheckboxChange);
  const fallback = Object.fromEntries(module.选项.map((option) => [option.ID, option.默认选中 ?? false]));
  const value = readCheckboxState(rawValue, fallback);
  const labelId = `module-${module.ID}-label`;
  const rows = groupOptions(module.选项);

  const setChecked = (optionId: string, checked: boolean) => {
    commitCheckboxChange(module.ID, optionId, checked, { ...value, [optionId]: checked });
  };

  return (
    <div className="container container-stack" data-module-id={module.ID} data-module-type={module.类型} data-part="container" role="group" aria-labelledby={labelId}>
      <div id={labelId} className="label" data-part="label">
        {module.标签}
      </div>
      <div className="checkbox-list" data-part="options">
        {rows.map((row) => row.options.length === 1 && !row.group ? (
          <label className="checkbox-row" data-part="option" key={row.options[0].ID}>
            <input data-part="input" type="checkbox" checked={value[row.options[0].ID] ?? false} onChange={(event) => setChecked(row.options[0].ID, event.target.checked)} />
            <span data-part="option-label">{row.options[0].标签}</span>
          </label>
        ) : (
          <div className="checkbox-row checkbox-row-grouped" data-option-group={row.group} data-part="option-group" key={row.group}>
            <span className="checkbox-input-group" data-part="group-inputs">
              {row.options.map((option, index) => (
                <input
                  aria-label={`${option.标签} ${index + 1}`}
                  data-part="input"
                  key={option.ID}
                  type="checkbox"
                  checked={value[option.ID] ?? false}
                  onChange={(event) => setChecked(option.ID, event.target.checked)}
                />
              ))}
            </span>
            <span data-part="option-label">{row.options[0].标签}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type CheckboxOption = CheckboxResourceModuleConfig["选项"][number];
interface CheckboxOptionRow { group?: string; options: CheckboxOption[] }

function groupOptions(options: CheckboxResourceModuleConfig["选项"]): CheckboxOptionRow[] {
  const emittedGroups = new Set<string>();
  const rows: CheckboxOptionRow[] = [];
  for (const option of options) {
    if (!option.分组) {
      rows.push({ options: [option] });
      continue;
    }
    if (emittedGroups.has(option.分组)) continue;
    emittedGroups.add(option.分组);
    rows.push({ group: option.分组, options: options.filter((candidate) => candidate.分组 === option.分组) });
  }
  return rows;
}
