import { playerCardTracks } from "../../../core/player-card/1.0.0/capability.ts";
import { EditorInput, EditorTextarea, textValue } from "../../authoring-primitives.tsx";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";
import { PlayerCardCountInput } from "./count-input.tsx";

export function PlayerCardAuthoringEditor({ data, onValue }: TemplateAuthoringEditorProps) {
  return <div className="template-owned-editor player-card-editor">
    <style>{standardEditorStyles}</style>
    <section>
      <EditorInput label="角色名" value={data.名称} onChange={(value) => onValue("名称", value)} />
      <EditorInput label="玩家名" value={data.玩家名} onChange={(value) => onValue("玩家名", value)} />
      <EditorInput label="类型" value={data.类型} onChange={(value) => onValue("类型", value)} />
    </section>
    <section>{playerCardTracks.map((track) => <label className="template-editor-field" key={track.field}>
      <span>{track.maximum}</span>
      <PlayerCardCountInput label={track.maximum} value={textValue(data[track.maximum])} onCommit={(value) => onValue(track.maximum, value)} />
    </label>)}</section>
    <section><div className="template-editor-span-all"><EditorTextarea label="备注" value={data.备注} onChange={(value) => onValue("备注", value)} /></div></section>
  </div>;
}

export const playerCardAuthoring: TemplateAuthoringCapability = {
  templateId: "玩家卡", templateVersion: "1.0.0", Editor: PlayerCardAuthoringEditor, replacements: "after",
};
