import type { LongTextModule as LongTextModuleConfig } from "../domain/systemPackage";
import type { CSSProperties, RefObject } from "react";
import { useTextModuleState } from "./moduleState";
import { EditableMarkdownValue } from "./EditableMarkdownValue";
import { useRuntimeStore } from "../store/runtimeStore";

interface LongTextModuleProps {
  module: LongTextModuleConfig;
}

export function LongTextModule({ module }: LongTextModuleProps) {
  const [value, setValue] = useTextModuleState(module.ID, module.默认值 ?? "");
  const derivedPlaceholder = useRuntimeStore((state) => state.derivedTextPlaceholders[module.ID]);
  const inputId = `module-${module.ID}`;
  const labelHidden = module.隐藏标签 === true || module.标签 === "";
  const placeholder = derivedPlaceholder ?? module.占位文本;
  const accessibleName = module.标签 || placeholder || module.ID;
  const rows = module.行数 ?? 4;
  const style = {
    "--long-text-rows": rows,
    "--long-text-height": `calc(${rows * 1.2}rem + 6px)`,
  } as CSSProperties;

  return (
    <div className="container container-stack" data-module-id={module.ID} data-module-type={module.类型} data-part="container" data-label-hidden={labelHidden ? "true" : undefined} style={style}>
      {!labelHidden ? (
        <label className="label" data-part="label" htmlFor={inputId}>
          {module.标签}
        </label>
      ) : null}
      <EditableMarkdownValue
        value={value}
        accessibleName={accessibleName}
        autoFit
        input={(props) => (
          <textarea
            ref={props.ref as RefObject<HTMLTextAreaElement>}
            id={inputId}
            className="input textarea"
            data-part="input"
            aria-label={labelHidden ? accessibleName : undefined}
            placeholder={placeholder}
            rows={rows}
            value={props.value}
            onFocus={props.onFocus}
            onBlur={props.onBlur}
            onChange={(event) => { setValue(event.target.value); props.onChange(event.target.value); }}
          />
        )}
      />
    </div>
  );
}
