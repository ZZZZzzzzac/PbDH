import { useRef, useState } from "react";
import { useSealChatNumber } from "./SealChatResources.tsx";
export function SealChatNumberInput({ moduleId, inputId, label }: { moduleId: string; inputId: string; label: string }) {
  const remote = useSealChatNumber(moduleId)!;
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const [feedback, setFeedback] = useState("");
  return <input id={inputId} className="input" data-part="input" aria-label={label} inputMode="numeric"
    value={draft ?? (remote.value === null ? "" : String(remote.value))} placeholder="—" disabled={remote.disabled}
    title={feedback || "失焦或回车保存到 Dice"} aria-invalid={!!feedback}
    onFocus={() => { cancelled.current = false; setDraft(remote.value === null ? "" : String(remote.value)); setFeedback(""); }}
    onChange={event => setDraft(event.target.value)}
    onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
      if (event.key === "Escape") { cancelled.current = true; setDraft(null); event.currentTarget.blur(); } }}
    onBlur={event => {
      const next = event.currentTarget.value;
      setDraft(null);
      if (cancelled.current) { cancelled.current = false; return; }
      if (next === String(remote.value ?? "") || /^[+-]?\d+$/.test(next.trim()) && Number(next) === remote.value) return;
      if (!/^[+-]?\d+$/.test(next.trim())) { setFeedback("请输入整数"); return; }
      void remote.set(next, remote.binding).then(sent => { if (!sent) setFeedback("未保存，请核对同步状态与数值范围"); });
    }} />;
}
