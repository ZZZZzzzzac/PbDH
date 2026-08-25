import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import type { ReactNode } from "react";

import {
  weaponTemplateV2,
  type WeaponDataV2,
} from "../../../core/index.ts";

export type WeaponRuntimeStateV2 = Record<string, never>;

export {
  weaponCardDesignSource as weaponCardDesignSourceV2,
  weaponRendererStyles as weaponRendererStylesV2,
} from "../1.0.0-alpha.1/design.generated.ts";
import { weaponRendererStyles } from "../1.0.0-alpha.1/design.generated.ts";

function isWeaponState(value: unknown): value is WeaponRuntimeStateV2 {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === 0;
}

function splitDescription(value: string): { title: string; body: string } {
  const separator = value.search(/[:：]/);
  if (separator < 0) return { title: "特性", body: value };
  return {
    title: value.slice(0, separator).trim() || "特性",
    body: value.slice(separator + 1).trim(),
  };
}

export const weaponRendererRevisionV2: RendererRevisionCapability<
  WeaponDataV2,
  WeaponRuntimeStateV2,
  ReactNode
> = {
  revision: "weapon-card-r2",
  templateId: "武器",
  templateVersion: "1.0.0-alpha.2",
  requiredMediaSlots: [],
  optionalMediaSlots: ["portrait"],
  defaultState(data) {
    return weaponTemplateV2.tabletop.defaultState(data) as WeaponRuntimeStateV2;
  },
  validateState: isWeaponState,
  styles: weaponRendererStyles,
  render({ data, presentation, assets }) {
    const feature = splitDescription(data.描述);
    const portrait = assets.portrait;
    const mode = presentation.mode;
    const cardClass = [
      "weapon-card",
      `is-${mode}`,
      presentation.fixedRatio ? "" : "is-fluid",
    ].filter(Boolean).join(" ");
    return (
      <article className={cardClass} data-renderer-revision="weapon-card-r2" data-presentation-mode={mode}>
        {mode === "image" ? <div className="weapon-art is-image-only">
          {portrait ? <img src={portrait} alt={data.名称} /> : <div className="weapon-image-missing" role="status">缺少主图</div>}
        </div> : <>
        <header className="weapon-header">
          <div className="weapon-meta">
            <span className="weapon-type">{data.类型}</span>
            <span className="weapon-tier">位阶 {data.位阶}</span>
          </div>
          <h1 className="weapon-title">{data.名称}</h1>
          <p className="weapon-summary">{data.属性} · {data.距离} · {data.负荷}</p>
          {data.风味描述 && <p className="weapon-flavor">{data.风味描述}</p>}
        </header>
        {mode === "split" && <div className="weapon-art">{portrait ? <img src={portrait} alt="" /> : <div className="weapon-image-missing" role="status">缺少主图</div>}</div>}
        <div className="weapon-body">
          <section className="weapon-stats" aria-label="武器数据">
            <div className="weapon-stat"><b>{data.属性}</b><span>属性</span></div>
            <div className="weapon-stat"><b>{data.距离}</b><span>距离</span></div>
            <div className="weapon-stat"><b>{data.伤害}</b><span>伤害</span></div>
          </section>
          <section className="weapon-details" aria-label="伤害与负荷">
            <div className="weapon-detail"><span>伤害类型</span><b>{data.伤害类型}</b></div>
            <div className="weapon-detail"><span>负荷</span><b>{data.负荷}</b></div>
          </section>
          <section className="weapon-description" aria-label="武器游戏效果">
            <h2>{feature.title}</h2>
            <hr />
            <p>{feature.body}</p>
          </section>
          <p className="weapon-footer">DAGGERHEART CORE · 武器</p>
        </div>
        </>}
      </article>
    );
  },
};
