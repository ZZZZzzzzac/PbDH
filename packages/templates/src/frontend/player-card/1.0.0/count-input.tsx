import { useEffect, useState } from "react";

export function PlayerCardCountInput({ label, value, maximum, readOnly, onCommit }: {
  label: string; value: string; maximum?: bigint; readOnly?: boolean; onCommit(value: string): void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (readOnly) return;
    const text = draft.trim();
    if (!/^[0-9]+$/.test(text)) { setDraft(value); return; }
    const count = BigInt(text);
    const next = String(maximum !== undefined && count > maximum ? maximum : count);
    setDraft(next);
    if (next !== value) onCommit(next);
  };
  return <input aria-label={label} inputMode="numeric" value={draft} readOnly={readOnly}
    onChange={(event) => setDraft(event.target.value)} onBlur={commit}
    onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
    }} />;
}
