import type { FreeTextModule } from "../domain/systemPackage";
import type { RefObject } from "react";
import { useTextModuleState } from "./moduleState";
import { EditableMarkdownValue } from "./EditableMarkdownValue";
import { fitSingleLineTextContent } from "./textFit";
import { useRuntimeStore } from "../store/runtimeStore";

interface FreeTextModuleProps {
  module: FreeTextModule;
}

export function FreeTextModule({ module }: FreeTextModuleProps) {
  const [value, setValue] = useTextModuleState(module.ID, module.默认值 ?? "");
  const commitFreeTextChange = useRuntimeStore((state) => state.commitFreeTextChange);
  const derivedPlaceholder = useRuntimeStore((state) => state.derivedTextPlaceholders[module.ID]);
  const inputId = `module-${module.ID}`;
  const labelHidden = module.隐藏标签 === true || module.标签 === "";
  const placeholder = derivedPlaceholder ?? module.占位文本;
  const accessibleName = module.标签 || placeholder || module.ID;
  const dropdownOptions = module.选项;
  const valueIsDeclared = value === "" || (dropdownOptions?.includes(value) ?? true);

  return (
    <div
      className="container"
      data-module-id={module.ID}
      data-module-type={module.类型}
      data-part="container"
      data-label-hidden={labelHidden ? "true" : undefined}
      data-free-text-mode={dropdownOptions ? "select" : "input"}
    >
      {!labelHidden ? (
        <label className="label" data-part="label" htmlFor={inputId}>
          {module.标签}
        </label>
      ) : null}
      {dropdownOptions ? (
        <select
          id={inputId}
          className="input"
          data-part="input"
          aria-label={labelHidden ? accessibleName : undefined}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={(event) => commitFreeTextChange(module.ID, event.currentTarget.value)}
        >
          {value === "" ? <option value="" disabled>{placeholder || "请选择"}</option> : null}
          {!valueIsDeclared ? <option value={value} disabled>{value}</option> : null}
          {dropdownOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <EditableMarkdownValue
          value={value}
          accessibleName={accessibleName}
          autoFit
          fitText={fitSingleLineTextContent}
          input={(props) => (
            <input
              ref={props.ref as RefObject<HTMLInputElement>}
              id={inputId}
              className="input"
              data-part="input"
              aria-label={labelHidden ? accessibleName : undefined}
              placeholder={placeholder}
              value={props.value}
              onFocus={props.onFocus}
              onBlur={(event) => {
                props.onBlur();
                commitFreeTextChange(module.ID, event.currentTarget.value);
              }}
              onChange={(event) => { setValue(event.target.value); props.onChange(event.target.value); }}
            />
          )}
        />
      )}
    </div>
  );
}
