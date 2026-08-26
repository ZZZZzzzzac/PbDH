import type { QuestionnaireDefinition } from "../domain/questionnaireContract";

export const questionnaireMessageType = "pbdh-questionnaire-result";

export interface QuestionnaireHostSession {
  close: () => void;
  popup: Window;
}

export type QuestionnaireHostOpenResult =
  | { ok: true; session: QuestionnaireHostSession }
  | { ok: false; error: string };

export function openQuestionnaireHost(
  questionnaire: QuestionnaireDefinition,
  onResult: (result: unknown) => void,
): QuestionnaireHostOpenResult {
  const popup = window.open("", "_blank");
  if (!popup) {
    return { ok: false, error: "浏览器阻止了问卷标签页。请允许此站点打开弹出式窗口后重试。" };
  }

  try {
    const document = popup.document;
    document.title = questionnaire.名称;
    document.documentElement.lang = "zh-CN";
    document.body.replaceChildren();
    Object.assign(document.body.style, {
      margin: "0",
      background: "#111318",
      color: "#f5f7fa",
      fontFamily: "system-ui, sans-serif",
    });

    const status = document.createElement("div");
    status.textContent = `PbDH · ${questionnaire.名称}`;
    Object.assign(status.style, {
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      height: "36px",
      padding: "0 12px",
      background: "#181b21",
      borderBottom: "1px solid #30343d",
      color: "#b9c0cc",
      fontSize: "12px",
    });

    const iframe = document.createElement("iframe");
    iframe.title = questionnaire.名称;
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.srcdoc = addQuestionnaireCsp(questionnaire.htmlContent);
    Object.assign(iframe.style, {
      display: "block",
      width: "100%",
      height: "calc(100vh - 36px)",
      border: "0",
      background: "#fff",
    });
    document.body.append(status, iframe);

    let submitted = false;
    const handleMessage = (event: MessageEvent) => {
      if (submitted || event.source !== iframe.contentWindow) return;
      if (!isQuestionnaireEnvelope(event.data)) return;
      submitted = true;
      onResult(event.data.result);
      cleanup();
      popup.close();
    };
    const cleanup = () => {
      popup.removeEventListener("message", handleMessage);
      popup.removeEventListener("pagehide", cleanup);
    };
    popup.addEventListener("message", handleMessage);
    popup.addEventListener("pagehide", cleanup, { once: true });
    popup.focus();

    return {
      ok: true,
      session: {
        popup,
        close: () => {
          cleanup();
          if (!popup.closed) popup.close();
        },
      },
    };
  } catch (error) {
    popup.close();
    return {
      ok: false,
      error: `无法打开问卷：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function isQuestionnaireEnvelope(value: unknown): value is { type: typeof questionnaireMessageType; result: unknown } {
  return typeof value === "object"
    && value !== null
    && "type" in value
    && value.type === questionnaireMessageType
    && "result" in value;
}

function addQuestionnaireCsp(html: string): string {
  const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; connect-src 'none'; font-src 'none'; frame-src 'none'; child-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; navigate-to 'none'";
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  const head = /<head(?:\s[^>]*)?>/iu;
  if (head.test(html)) return html.replace(head, (match) => `${match}${meta}`);
  return `<!doctype html><html><head>${meta}</head><body>${html}</body></html>`;
}
