import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { RestrictedMarkdown } from "./RestrictedMarkdown";
import { fitTextContent, useTextFit } from "./textFit";
import type { FontSizeFitResult } from "./fontSizeFit";

interface EditableMarkdownValueProps {
  value: string;
  accessibleName: string;
  input: (props: EditableMarkdownInputProps) => ReactNode;
  autoFit?: boolean;
  fitText?: (element: HTMLElement) => FontSizeFitResult;
}

export interface EditableMarkdownInputProps {
  ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}

export function EditableMarkdownValue({ value, accessibleName, input, autoFit = false, fitText = fitTextContent }: EditableMarkdownValueProps) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const showEditor = editing || value === "";
  useTextFit(previewRef, value, autoFit && !showEditor, fitText);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  const beginEditing = () => setEditing(true);
  const onPreviewKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      beginEditing();
    }
  };

  return (
    <>
      {showEditor ? (
        <div data-markdown-editor="true" data-markdown-empty={value === "" ? "true" : undefined}>
          {input({
            ref: inputRef,
            value,
            onChange: () => setEditing(true),
            onFocus: beginEditing,
            onBlur: () => setEditing(false),
          })}
        </div>
      ) : null}
      <div
        ref={previewRef}
        className="markdown-preview"
        data-part="input"
        data-markdown-preview="true"
        data-markdown-empty={value === "" ? "true" : undefined}
        hidden={showEditor}
        aria-hidden={showEditor ? "true" : undefined}
        role={showEditor ? undefined : "button"}
        tabIndex={showEditor ? undefined : 0}
        aria-label={showEditor ? undefined : accessibleName}
        onClick={beginEditing}
        onKeyDown={onPreviewKeyDown}
      >
        <RestrictedMarkdown value={value} />
      </div>
    </>
  );
}
