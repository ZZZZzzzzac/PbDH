import { useEffect, useMemo, useState } from "react";

import type {
  ResourcePackageCandidate,
  ResourcePackageLogicalDocument,
  SystemPackageDocument,
} from "@pbdh/contract-runtime";
import { PlatformAppBar } from "@pbdh/platform-ui";
import { CanonicalCardSurface } from "@pbdh/resource-renderer/react";
import { adversaryRendererFor } from "@pbdh/templates/frontend";
import type { AdversaryData } from "@pbdh/templates/core";

import primaryWeaponPackageJson from "../../../contracts/conformance/resource-package/1.0.0-alpha.1/valid/daggerheart-core-primary-weapon.json";
import systemJson from "../../../contracts/conformance/system-package/1.0.0-alpha.1/valid/daggerheart/system.json";

import { ResourceManager } from "./resource-manager/ResourceManager.tsx";
import { ResourcePickerDialog } from "./resource-manager/ResourcePickerDialog.tsx";
import {
  applyResourceSelection,
  type CharacterData,
} from "./resources/apply-resource-selection.ts";
import {
  commitResourcePackageInstall,
  type ResourcePackageInstallPlan,
} from "./resources/resource-library.ts";
import { DexieResourcePackageRepository } from "./resources/resource-package-repository.ts";
import { routeResourcePackage } from "./resources/route-resource-package.ts";
import type { InstalledResourcePackage, ResourceLibrary } from "./resources/resource-library.ts";

const currentSystem = systemJson as SystemPackageDocument;
const primaryWeaponDocument = primaryWeaponPackageJson as ResourcePackageLogicalDocument;
const primaryWeaponInstalled: InstalledResourcePackage = {
  document: primaryWeaponDocument,
  media: new Map(),
  routes: routeResourcePackage({ currentSystem, resourcePackage: primaryWeaponDocument }),
};
const primaryWeaponPicker = currentSystem.modules.find(
  (module): module is Extract<SystemPackageDocument["modules"][number], { type: "resourcePicker" }> =>
    module.type === "resourcePicker" && module.id === "pick-primary-weapon",
);

type WeaponData = {
  名称: string;
  类型: string;
  属性: string;
  距离: string;
  伤害: string;
  负荷: string;
  伤害类型: string;
  描述: string;
  位阶: string;
};

export function PlayerAppPrototype() {
  const repository = useMemo(() => new DexieResourcePackageRepository(), []);
  const [library, setLibrary] = useState<ResourceLibrary>(() => new Map([
    [primaryWeaponDocument.package.id, primaryWeaponInstalled],
  ]));
  const [managerOpen, setManagerOpen] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerError, setPickerError] = useState<string>();
  const [characterData, setCharacterData] = useState<CharacterData>({});
  const [openResource, setOpenResource] = useState(() => ({
    installed: primaryWeaponInstalled,
    resourceId: primaryWeaponDocument.resources[0]!.id,
  }));
  const resource = openResource.installed.document.resources.find(
    (candidate) => candidate.id === openResource.resourceId,
  );
  const previewResource = resource?.template.id === "敌人"
    ? { ...resource, data: resource.data as unknown as AdversaryData }
    : undefined;
  const weapon = resource?.template.id === "武器"
    ? resource.data as unknown as WeaponData
    : undefined;
  const route = openResource.installed.routes.find((candidate) =>
    candidate.resource.id === openResource.resourceId);
  const resourceArea = route?.nativeEntry?.label ?? "其他资源";
  const [assets, setAssets] = useState(new Map<string, { status: "ready"; url: string }>());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let stored = await repository.list();
        if (!stored.some((candidate) => candidate.document.package.id === primaryWeaponDocument.package.id)) {
          const candidate: ResourcePackageCandidate = {
            document: primaryWeaponDocument,
            media: new Map(),
          };
          await repository.replace(candidate, "bundled");
          stored = await repository.list();
        }
        if (cancelled) return;
        const restored = new Map(stored.map((candidate) => [candidate.document.package.id, {
          document: candidate.document,
          media: candidate.media,
          routes: routeResourcePackage({ currentSystem, resourcePackage: candidate.document }),
        }]));
        setLibrary(restored);
        const first = restored.get(primaryWeaponDocument.package.id) ?? restored.values().next().value;
        const firstResource = first?.document.resources[0];
        if (first && firstResource) setOpenResource({ installed: first, resourceId: firstResource.id });
      } catch (error) {
        console.error("无法恢复本地资源库", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repository]);

  useEffect(() => {
    if (!resource) {
      setAssets(new Map());
      return;
    }
    const urls = new Map<string, { status: "ready"; url: string }>();
    for (const assetId of Object.values(resource.media)) {
      const bytes = openResource.installed.media.get(assetId);
      if (bytes) {
        const mediaType = openResource.installed.document.assets.find((asset) => asset.id === assetId)?.mediaType;
        const blobBytes = new Uint8Array(bytes.byteLength);
        blobBytes.set(bytes);
        urls.set(assetId, {
          status: "ready",
          url: URL.createObjectURL(new Blob([blobBytes.buffer], { type: mediaType ?? "application/octet-stream" })),
        });
      }
    }
    setAssets(urls);
    return () => {
      for (const asset of urls.values()) {
        if (asset.url.startsWith("blob:")) URL.revokeObjectURL(asset.url);
      }
    };
  }, [openResource.installed, resource]);

  async function commitInstall(
    plan: Exclude<ResourcePackageInstallPlan, { kind: "no-op" }>,
  ) {
    await repository.replace(plan.candidate, "file");
    setLibrary((current) => commitResourcePackageInstall(current, plan));
  }

  return <main className="player-app">
    <PlatformAppBar
      activePage="player"
      extraActions={<nav className="player-actions" aria-label="玩家功能"><button>玩家功能⌄</button><button>玩家存档⌄</button><button>导入导出⌄</button><button onClick={() => setManagerOpen(true)}>系统包⌄</button></nav>}
    />

    <div className="player-shell">
      <aside className="sheet-index"><h2>人物卡</h2><button className="selected">阿斯特里德</button><button>新建人物</button><footer><button onClick={() => setManagerOpen(true)}>资源管理器</button></footer></aside>
      <section className="character-sheet"><header><div><small>DAGGERHEART</small><h1>阿斯特里德</h1></div><span>等级 3</span></header>
        <div className="sheet-grid"><section><h2>属性</h2><div className="attribute-grid">{[["敏捷","+2"],["力量","+1"],["精准","+0"],["直觉","+1"],["风度","−1"],["知识","+2"]].map(([label,value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div></section><section><h2>经历</h2><p>荒野向导　+2</p><p>古老遗迹研究者　+1</p></section><section><h2>生命与压力</h2><div className="tracks"><b>生命</b><span>○ ○ ○ ○ ○ ○</span><b>压力</b><span>◇ ◇ ◇ ◇ ◇ ◇</span></div></section><section className="sheet-weapon"><header><h2>主武器</h2><button disabled={!primaryWeaponPicker} onClick={() => { setPickerError(undefined); setPickerOpen(true); }}>{primaryWeaponPicker?.buttonLabel ?? "资源库不可用"}</button></header><div className="weapon-values"><p>{renderInlineText(characterData["primary-weapon-name"] ?? "—")}</p><p>{characterData["primary-weapon-description"] ?? "—"}</p></div></section></div>
      </section>
      <aside className="native-resources"><header><h2>{resourceArea}</h2><button onClick={() => setManagerOpen(true)}>管理资源</button></header>
        {weapon && <section className="native-weapon" aria-label="主武器详情">
          <header><div><small>{weapon.类型} · 位阶 {weapon.位阶}</small><h3>{weapon.名称}</h3></div><b>{weapon.伤害}</b></header>
          <dl><div><dt>属性</dt><dd>{weapon.属性}</dd></div><div><dt>距离</dt><dd>{weapon.距离}</dd></div><div><dt>负荷</dt><dd>{weapon.负荷}</dd></div><div><dt>伤害类型</dt><dd>{weapon.伤害类型}</dd></div></dl>
          <p>{weapon.描述}</p>
        </section>}
        {previewResource && <div className="native-card"><CanonicalCardSurface resource={previewResource} expectedRendererRevision="enemy-card-r1" renderer={adversaryRendererFor(previewResource.template.version)} assets={assets} label="敌人卡预览" /></div>}
      </aside>
    </div>

    {managerOpen && <ResourceManager currentSystem={currentSystem} library={library} onCommitInstall={commitInstall} onClose={() => setManagerOpen(false)} onOpenResource={(installed, resourceId) => { setOpenResource({ installed, resourceId }); setManagerOpen(false); }} />}
    {pickerOpen && primaryWeaponPicker?.type === "resourcePicker" && <ResourcePickerDialog library={library} module={primaryWeaponPicker} error={pickerError} onClose={() => setPickerOpen(false)} onCommit={(candidate) => {
      const result = applyResourceSelection({
        characterData,
        currentSystem,
        sourceModuleId: primaryWeaponPicker.id,
        selectedResource: candidate.resource,
      });
      if (result.diagnostics.length > 0) {
        console.error("无法应用所选资源", result.diagnostics);
        setPickerError("无法应用：所选资源缺少系统要求的字段");
        return;
      }
      setPickerError(undefined);
      setCharacterData(result.characterData);
      setOpenResource({ installed: candidate.installed, resourceId: candidate.resource.id });
      setPickerOpen(false);
    }} />}
  </main>;
}

function renderInlineText(value: string) {
  const match = /^\*\*(.+?)\*\*(.*)$/u.exec(value);
  return match ? <><strong>{match[1]}</strong>{match[2]}</> : value;
}
