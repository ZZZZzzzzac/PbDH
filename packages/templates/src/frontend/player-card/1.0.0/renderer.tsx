import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Flame, Heart, Hexagon, Shield, Zap } from "lucide-react";
import { PlayerCardCountInput } from "./count-input.tsx";
import type { RendererRevisionCapability, SurfacePresentation, SurfaceAttribution } from "@pbdh/resource-renderer/core";
import { CardFooter, SingleLineTextFit } from "@pbdh/resource-renderer/react";
import { playerCardTemplate, playerCardTracks, type PlayerCardData, type PlayerCardState } from "../../../core/player-card/1.0.0/capability.ts";

const countPattern = /^(0|[1-9][0-9]*)$/;
function isPlayerCardState(value: unknown): value is PlayerCardState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  return Object.keys(state).length === 5 && typeof state.notes === "string"
    && playerCardTracks.every(({ field }) => typeof state[field] === "string" && countPattern.test(state[field]));
}

export const playerCardRendererStyles = `
.player-card-frame{position:relative;width:63px;height:88px;overflow:hidden}
.player-card-frame.is-fluid{overflow:visible}
.player-card{--bone:#eee4d0;--oxblood:#641f1d;box-sizing:border-box;position:absolute;inset:0 auto auto 0;width:360px;height:502.857px;transform:scale(.175);transform-origin:top left;display:flex;flex-direction:column;overflow:hidden;border:3px solid #21150f;background:var(--bone);color:#1d1713;font-family:"Noto Sans SC",sans-serif;letter-spacing:0}
.player-card *{box-sizing:border-box;min-width:0}
.player-card.is-fluid{height:auto;min-height:502.857px;overflow:visible}
.player-card.is-split.has-fixed-base{height:var(--split-fixed-native-height)}
.player-card-header{flex:none;min-height:74px;padding:10px 14px;background:#251a14;color:#fff4df}
.player-card-title{margin:0;font:800 var(--player-card-title-size,28px)/1.2 "Noto Sans SC",sans-serif;overflow:hidden}
.player-card-identity{display:flex;justify-content:space-between;gap:10px;margin-top:4px;color:#d8ba91;font-size:13px;line-height:1.4;overflow-wrap:anywhere}
.player-card-art{flex:none;background:#e2e5df}
.player-card-art img{display:block;width:100%;height:auto}
.player-card.is-split .player-card-art{position:relative}
.player-card.is-split .player-card-art img{object-fit:contain}
.player-card.is-split .player-card-art::after{content:"";position:absolute;inset:auto 0 0;height:24px;background:linear-gradient(180deg,#251a1400,#251a14);pointer-events:none}
.player-card.is-image .player-card-art{height:100%}
.player-card.is-image:not(.is-fluid) .player-card-art img{height:100%;object-fit:cover}
.player-card-image-missing{min-height:120px;display:grid;place-items:center;font-size:16px}
.player-card-body{display:flex;flex:1;flex-direction:column;gap:12px;padding:10px;min-height:0}
.player-card-tracks{display:grid;gap:8px;flex:none}
.player-card-track{display:flex;align-items:flex-start;gap:6px;min-height:26px}
.player-card-track-label{width:58px;height:26px;flex:none;display:grid;place-items:center;background:#21150f;color:#f8ddba;font:700 13px/1.25 "Noto Sans SC",sans-serif}
.player-card-markers{display:flex;flex:1;flex-wrap:wrap;gap:4px;min-width:0;color:#111827}
.player-card-marker{position:relative;width:24px;height:24px;flex:none;display:grid;place-items:center;padding:0;border:0;background:transparent;color:inherit}
.player-card-marker svg{width:24px;height:24px;fill:transparent;stroke-width:2}
.player-card-marker[aria-pressed="true"]>svg:first-child{fill:currentColor}
.player-card-marker .player-card-bolt{position:absolute;width:15px;height:18px;stroke-width:1.6}
.player-card-marker[aria-pressed="true"] .player-card-bolt{fill:var(--bone);stroke:var(--bone)}
.player-card-marker:not(:disabled){cursor:pointer}
.player-card-marker:disabled{cursor:default}
.player-card-track.is-stress{color:#424039}
.player-card-track.is-hope .player-card-markers{color:var(--oxblood)}
.player-card-track.is-armor .player-card-markers{color:#725747}
.player-card-empty{height:24px;display:grid;place-items:center;width:24px;color:#725747}
.player-card-count-fallback{display:flex;gap:6px;align-items:center;max-width:100%;overflow-wrap:anywhere;font-size:12px}
.player-card-count-fallback input{width:70px;min-width:0}
.player-card-notes{display:flex;flex:1;flex-direction:column;gap:6px;min-height:64px;font:700 13px/1.4 "Noto Sans SC",sans-serif}
.player-card-notes>span{display:flex;align-items:center;gap:8px;color:var(--oxblood)}
.player-card-notes>span::after{content:"";flex:1;height:2px;background:#b88a57}
.player-card-notes textarea{width:100%;flex:1;min-height:64px;padding:6px;border:1px solid #d4b78d;border-radius:4px;background:#f7ebd6;color:#1d1713;resize:none;font:450 14px/1.4 "Noto Sans SC",sans-serif}
.player-card-notes p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-weight:450;overflow:auto}
.player-card :is(button,input,textarea):focus-visible{outline:2px solid #627e98;outline-offset:2px}
.player-card>.pbdh-card-footer{border-top:1px solid #d4b78d;color:#725747;background:var(--bone)}
.player-card:not(.is-fluid) .player-card-header,.player-card.has-fixed-base .player-card-header{max-height:110px;overflow:auto}
.player-card:not(.is-fluid) .player-card-body,.player-card.has-fixed-base .player-card-body{overflow:auto}
.player-card:not(.is-fluid) .player-card-notes,.player-card.has-fixed-base .player-card-notes{min-height:80px;overflow:hidden}
.player-card:not(.is-fluid) .player-card-notes p,.player-card.has-fixed-base .player-card-notes p{flex:1;min-height:0;overflow:auto}
`;

function PlayerCard({ data, state, presentation, portrait, attribution, onStateCommand }: {
  data: PlayerCardData; state: PlayerCardState; presentation: SurfacePresentation; portrait?: string;
  attribution: SurfaceAttribution; onStateCommand?: (commandId: string, value: string) => void;
}) {
  const fixedSurface = presentation.fixedRatio && presentation.mode !== "split";
  const splitFixed = presentation.fixedRatio && presentation.mode === "split";
  const cardRef = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(502.857);
  useLayoutEffect(() => {
    if (fixedSurface) { setHeight(502.857); return; }
    const card = cardRef.current;
    if (!card) return;
    const image = card.querySelector("img");
    const measure = () => setHeight(splitFixed ? 502.857 + (image?.offsetHeight ?? 0) : card.offsetHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    if (image) observer.observe(image);
    measure();
    return () => observer.disconnect();
  }, [fixedSurface, splitFixed, portrait]);

  return <div className={`player-card-frame${fixedSurface ? "" : " is-fluid"}`}
    style={{ height: `${fixedSurface ? 88 : height * .175}px`, "--split-fixed-native-height": `${height}px` } as CSSProperties}>
    <article ref={cardRef} className={`player-card is-${presentation.mode}${fixedSurface ? "" : " is-fluid"}${splitFixed ? " has-fixed-base" : ""}`} data-renderer-revision="player-card-r1" data-presentation-mode={presentation.mode}>
      {presentation.mode !== "text" && (portrait || presentation.mode === "image") ? <div className="player-card-art">
        {portrait ? <img src={portrait} alt={data.名称} /> : <div className="player-card-image-missing" role="status">缺少肖像</div>}
      </div> : null}
      {presentation.mode !== "image" ? <>
        <header className="player-card-header">
          <SingleLineTextFit className="player-card-title" contentKey={data.名称} minFontSizePx={10} maxFontSizePx={28} cssVariable="--player-card-title-size">{data.名称 || "未命名玩家卡"}</SingleLineTextFit>
          <div className="player-card-identity"><span>玩家：{data.玩家名}</span><span>{data.类型}</span></div>
        </header>
        <div className="player-card-body">
          <section className="player-card-tracks" aria-label="玩家资源">
            {playerCardTracks.map((track) => {
              const current = BigInt(state[track.field]);
              const maximum = countPattern.test(data[track.maximum]) ? BigInt(data[track.maximum]) : 0n;
              const Marker = track.command === "hp" ? Heart : track.command === "stress" ? Hexagon : track.command === "hope" ? Flame : Shield;
              return <div className={`player-card-track is-${track.command}`} key={track.field}>
                <div className="player-card-track-label" title={track.meaning}>{track.label}</div>
                <div className="player-card-markers" role="group" aria-label={`${track.label}${track.meaning}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                  {Array.from({ length: Number(maximum > 60n ? 60n : maximum) }, (_, index) => {
                    const target = BigInt(index + 1);
                    return <button type="button" className="player-card-marker" key={index} aria-label={`${track.label}${index + 1}`} title={`${track.label}${track.meaning} ${index + 1}`} aria-pressed={current >= target} disabled={!onStateCommand}
                      onClick={() => onStateCommand?.(`set-${track.command}`, String(current === target ? target - 1n : target))}>
                      <Marker aria-hidden="true" />{track.command === "stress" && <Zap className="player-card-bolt" aria-hidden="true" />}
                    </button>;
                  })}
                  {maximum === 0n && <span className="player-card-empty" aria-label={`${track.label}无可用槽位`}>—</span>}
                  {(maximum > 60n || current > maximum) && <div className="player-card-count-fallback"><PlayerCardCountInput label={`${track.label}数量`} value={state[track.field]} maximum={maximum} readOnly={!onStateCommand} onCommit={(value) => onStateCommand?.(`set-${track.command}`, value)} /><span>/ {data[track.maximum]}</span></div>}
                </div>
              </div>;
            })}
          </section>
          <label className="player-card-notes"><span>备注</span>{onStateCommand
            ? <textarea aria-label="备注" value={state.notes} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onChange={(event) => onStateCommand("set-notes", event.target.value)} />
            : <p>{state.notes}</p>}</label>
        </div>
        <CardFooter attribution={attribution} />
      </> : null}
    </article>
  </div>;
}

export const playerCardRendererRevision: RendererRevisionCapability<PlayerCardData, PlayerCardState, ReactNode> = {
  revision: "player-card-r1", templateId: "玩家卡", templateVersion: "1.0.0",
  requiredMediaSlots: [], optionalMediaSlots: ["portrait"],
  defaultState(data) { return playerCardTemplate.tabletop.defaultState(data) as PlayerCardState; },
  validateState: isPlayerCardState,
  styles: playerCardRendererStyles,
  render({ data, state, assets, presentation, attribution, onStateCommand }) {
    return <PlayerCard data={data} state={state} portrait={assets.portrait} presentation={presentation} attribution={attribution ?? { artworkCredit: "", sourceLabel: "" }} onStateCommand={onStateCommand} />;
  },
};
