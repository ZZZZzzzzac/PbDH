import { useMemo, useState } from "react";

import { CanonicalCardSurface } from "@pbdh/resource-renderer/react";
import {
  adversaryRendererFor,
  type AdversaryRuntimeState,
} from "@pbdh/templates/frontend";
import type { AdversaryData } from "@pbdh/templates/core";

import minotaurImageUrl from "../../../../contracts/conformance/resource-package/1.0.0/media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp?url";
import minotaurPackage from "../../../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";

import { rendererLabHosts, type RendererLabScenario } from "./lab-model.ts";

const assetId = minotaurPackage.assets[0].id;
const baseResource = minotaurPackage.resources[0] as {
  template: { id: string; version: string };
  presentation: {
    mode: "text" | "split" | "image";
    fixedRatio: boolean;
  };
  data: AdversaryData;
  media: Record<string, string>;
};

const tabletopState: AdversaryRuntimeState = {
  currentHp: "3",
  currentStress: "4",
  focused: "true",
  notes: "角部受伤",
};

function scenarioInput(scenario: RendererLabScenario) {
  const resource = structuredClone(baseResource);
  let state: AdversaryRuntimeState | undefined;
  if (scenario === "tabletop" || scenario === "gm-private") state = tabletopState;
  if (scenario === "gm-private") {
    resource.data.名称 = "伤痕牛头人";
    resource.data.简介 = "GM 私有定义：左角断裂，正在守卫石门。";
  }
  const assets = new Map([
    [assetId, scenario === "media-error"
      ? { status: "error" as const, reason: "fixture decode failure" }
      : { status: "ready" as const, url: minotaurImageUrl }],
  ]);
  return { resource, state, assets };
}

function ScaledSurface({ scenario, scale }: { scenario: RendererLabScenario; scale: number }) {
  const input = useMemo(() => scenarioInput(scenario), [scenario]);
  const mmToPx = 96 / 25.4;
  const width = 63 * mmToPx * scale;
  const height = 88 * mmToPx * scale;
  return (
    <div className="surface-viewport" style={{ width, height }}>
      <div className="surface-scale" style={{ width: "63mm", height: "88mm", transform: `scale(${scale})` }}>
        <CanonicalCardSurface
          resource={input.resource}
          expectedRendererRevision="enemy-card-r1"
          renderer={adversaryRendererFor(input.resource.template.version)}
          assets={input.assets}
          state={input.state}
          label="牛头人破坏者规范卡面"
        />
      </div>
    </div>
  );
}

const scenarios: Array<{ id: RendererLabScenario; label: string }> = [
  { id: "default", label: "默认状态" },
  { id: "tabletop", label: "桌面状态" },
  { id: "gm-private", label: "GM 私有定义" },
  { id: "media-error", label: "异常媒体" },
];

export function RendererLab() {
  const [scenario, setScenario] = useState<RendererLabScenario>("default");
  return (
    <main className="lab">
      <header className="lab-header">
        <div>
          <p className="eyebrow">PBDH / RENDERER PROOF 001</p>
          <h1>同一张卡，四个宿主。</h1>
          <p className="lede">敌人@1.0.0 · enemy-card-r1 · 63:88 设计比例</p>
        </div>
        <div className="proof-mark" aria-hidden="true">R1</div>
      </header>

      <nav className="scenario-switcher" aria-label="校准场景">
        {scenarios.map((item) => (
          <button
            key={item.id}
            type="button"
            className={scenario === item.id ? "is-active" : ""}
            onClick={() => setScenario(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className="host-grid">
        {rendererLabHosts.map((host) => (
          <article className={`host-shell ${host.shellClass}`} key={host.id}>
            <header>
              <span>{host.label}</span>
              <code>{Math.round(host.scale * 100)}%</code>
            </header>
            <div className="host-stage">
              <ScaledSurface scenario={scenario} scale={host.scale} />
            </div>
            <footer>Shadow DOM · outer scale only</footer>
          </article>
        ))}
      </section>

      <aside className="review-strip">
        <b>人工检查</b>
        <span>信息层级</span><span>正文可读性</span><span>图片裁切</span><span>四种缩放</span><span>异常媒体边界</span>
      </aside>
    </main>
  );
}
