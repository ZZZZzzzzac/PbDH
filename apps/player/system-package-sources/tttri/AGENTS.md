# TTTRI System Package Author Rules

## 当前目录边界（优先于下方迁移期规则）

- 本目录现在只保留可编辑的资源 JSON、迁移清单和来源说明；资源文本仍以 `resources/*.json` 为准。
- Player 正式运行目录是 `apps/player/public/system-packages/tttri/`；页面、布局、皮肤、检查和运行时界面资产只在那里维护。
- 卡图与卡背已经装入正式 `.pbres`，不再保留散装 `assets/cards/**` 副本。
- 修改资源文本后运行 `scripts/generate-migrated-system-packages.ts`；生成器从现有 `.pbres` 复用媒体。
- 下方关于本目录 Skin 与 Assets 文件的规则仅为迁移历史，不再表示现行写入位置。

## PbDH migration

- 本目录是“罗德岛旅记”迁移后的 System Package 作者源。
- 初始来源固定为 `PbDH_sheet@0e44fa69b12209c172e4189e273615ba3a4d07a6` 的 `public/system-packages/tttri/`。
- 运行时制品生成到 `apps/player/public/system-packages/tttri/`，不得只修改生成目录。
- 不修改规则文本、平衡或视觉设计。

## Current stage

Resource review is complete. Implement the functional System Package in Issue order: #308, #309, #310, #311, then #312.

- Add and validate `manifest.json`, Pages, Sheet Modules, Dependencies, Guide, Checks, and Base Layouts as required by the active Issue.
- Keep the first Base Layout plain and functional: mount every Module exactly once, use semantic groups and stable Guide Regions, and contain printable content within A4.
- Run the normal package/build/test checks after resource or package changes.

## Sources and authority

- Runtime resource JSON under `resources/` is the sole local authority for resource text. Maintain it directly; do not regenerate it from archived Markdown or DOCX files.
- Use the Feishu Wiki linked from `README.md` when checking upstream updates.
- `docs/pbdh/粥/` is archived source material, not a generation input or authority over maintained JSON.
- For duplicate same-name Domain Card records, the later record is authoritative.
- `反制技巧` and `关键情报` are deprecated and must not appear in runtime resources.
- Do not infer text corrections from artwork. Confirmed artwork-name corrections are `掎角之锋` and `治愈苦痛`.

## Resource structure

- `resources/classes.json`: 7 Classes.
- `resources/subclasses.json`: 140 T1/T2/T3/T4X/T4Y Subclass entries.
- X/Y are elite Subclass stages, not a separate Resource Library.
- `子职提升` is display-only guidance; colored runs use Restricted Markdown color directives, and update behavior does not read it.
- `希望特性`、`职业特性`、`子职特性` use non-empty fields as explicit overwrite instructions; empty fields preserve current Long Text values.
- `resources/ancestries.json`: 35 individual Ancestries.
- `resources/communities.json`: 15 Communities.
- `resources/domain-cards.json`: 231 Domain Cards.
- `resources/armor.json`: TTTRI-owned armor catalog synchronized directly from the approved Feishu armor tables; do not replace it with `daggerheart-core` armor.
- `resources/loot.json`: provisional copy from `daggerheart-core`.
- No Weapons Resource Library; weapon prototypes belong to Subclass entries.
- `inventory` defaults to the approved Feishu operator starting supplies; the equivalent one-handful currency remains represented by the `handful-gold` Countable Resource.

## Skin

- `skins/rhodes-island/` 是 `defaultSkin`:Arknights 工业档案风(深色档案头、警示黄 accent、危险斜纹、条码、套准角标),零图片资产。
- `skins/terra-portal/` 是第二 Skin:还原 `ak.hypergryph.com/archive/dynamicCompile`(纯黑底、白字、灰辅、`#63bfd1` 强调、中英双标、扁平几何)。卡牌桌面纹章引用 `assets/icons/domain-*.svg`(11 领域图标水印,SVG 内置 SMIL 动画,源自 `docs/pbdh/粥/领域图标动画规范.md`),并按 `data-value-primary-domain` 与主领域联动,默认纹章为奇迹。
- Skin 写 `skins/<skin-id>/**`、`manifest.json` 中该 Skin 的注册项,以及 `assets/icons/` 下该 Skin 引用的装饰 SVG;不改 Base `layouts/`、`modules.json`、`pages.json`。
- 皮肤 CSS 的作用域处理器会丢弃 `@keyframes`;装饰动画用 SVG 内置 SMIL(`indefinite` 无限循环或有限 `repeatCount`)或 CSS transition。
- 纹章 SVG 的透明度统一由包裹组 `opacity` 控制,部件保持不透明填充;若用 `fill-opacity`,部件重叠处会半透明叠加变深。
- HTML override 必须保持每个 Page/Shell 的 `<pb-module>` ID 多重集合与全部 Guide Region 不变;Shell 保持唯一 `<pb-page-outlet>` 与一个 `data-print-page="true"`。
- 装饰一律绝对定位或零高度手段(box-shadow 描边),不改 Base 几何;A4 容量由 `tests/tttri.spec.ts` 验收,改动后必跑。

## Assets

- Domain Card 与 Ancestry 等大批量运行时图片只提交优化后 WebP;装饰图标可提交小体积 SVG(如 `assets/icons/`)。
- Do not copy PNG originals or Ancestry illustrations.
- All 231 Domain Cards use image presentation.
- `大地的慈悲-昭示`, `摇篮曲-终`, `归乡邀约-洗礼`, `召唤：炮台`, and `召唤：巨兵` are supplemental backs, not selectable entries.

## Review gate

Stop for Author review only when functional behavior, automated checks, and plain A4 containment are complete, or when source wording/visual judgment cannot be resolved from approved documents.
