import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export const tutorialUrl = "https://vcn3zvu2w61p.feishu.cn/docx/AopFdHoPmootkUx48Ujc8mVfn7c";
const preferenceKey = "pbdh:tutorial:do-not-show";

function isDismissed() {
  try { return localStorage.getItem(preferenceKey) === "true"; }
  catch { return false; }
}

export function TutorialEntry() {
  const [dismissed, setDismissed] = useState(isDismissed);
  const [open, setOpen] = useState(() => !isDismissed());
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); }, [open]);
  return <>
    <button type="button" aria-label="使用教程" title="使用教程" onClick={() => setOpen(true)}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4" /><path d="M12 16h.01" />
      </svg>
    </button>
    {open && createPortal(<dialog ref={dialog} className="pbdh-tutorial-dialog" aria-labelledby="pbdh-tutorial-title" onClose={() => setOpen(false)}>
      <h2 id="pbdh-tutorial-title">欢迎使用 PbDH</h2>
      <p>第一次使用，或遇到不熟悉的操作？可以先看看使用教程。</p>
      <a className="pbdh-tutorial-link" href={tutorialUrl} target="_blank" rel="noopener noreferrer">打开 PbDH 使用教程 ↗</a>
      <p className="pbdh-tutorial-hint">以后也可以点击顶部的圆圈问号，随时查看。</p>
      <footer>
        <label><input type="checkbox" checked={dismissed} onChange={(event) => {
          const value = event.target.checked;
          setDismissed(value);
          try { localStorage.setItem(preferenceKey, String(value)); } catch { /* 存储不可用时仍可关闭弹窗。 */ }
        }} />不再显示</label>
        <button type="button" onClick={() => dialog.current?.close()}>开始使用</button>
      </footer>
    </dialog>, document.body)}
  </>;
}
