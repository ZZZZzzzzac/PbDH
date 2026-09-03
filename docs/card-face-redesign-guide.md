# 武器与护甲卡面重绘说明

本文档交给后续负责视觉设计与前端实现的模型。它是自包含的：不要求阅读此前聊天，也不要求先理解整个 PbDH 项目。

## 1. 任务目标

重新设计武器卡与护甲卡的卡面。

用户已经明确否定当前非特性区域的视觉设计。不要在当前布局上继续调字号、间距、边框或比例；应当把武器和护甲的以下部分视为待删除的实验稿，从信息架构开始重新设计：

- 标题区内部排版；
- 武器核心数据与规则详情区；
- 护甲核心数据区；
- 上述区域与特性卡之间的空间关系。

以下部分不在本次重画范围内，应尽量原样保留：

- 特性卡的浅色纸面、细金边、酒红标题、标题尾部装饰横线；
- 特性名称、可选英文、特性描述与风味描述的渲染逻辑；
- 卡牌 footer；
- 纯文字、图文、纯图片三种展示模式；
- 固定比例与非固定比例行为；
- 63:88 Canonical Card Surface、媒体、Contract 与 Template 字段。

视觉风格应与项目中的种族、社群等卡牌属于同一套产品，而不是复制它们的具体网格。可参考：

- `packages/templates/src/frontend/ancestry/1.0.0/renderer.tsx`
- `packages/templates/src/frontend/reference-card/renderer-factory.tsx`

共同视觉语言包括：暖骨色纸张、深褐标题区、酒红强调、低饱和金色分隔线、清晰的中文粗体层级。不要引入紫色渐变、玻璃拟态、现代 SaaS 卡片、圆角胶囊标签或与桌游规则书不相干的图标系统。

## 2. 当前设计为什么被否定

当前工作树中的武器和护甲刚经历过两版失败尝试：

1. 第一版仍是平均切分的统计表，只是放大格子和文字，信息量少却挤在上方，下面留下大片无意义空白。
2. 第二版改成所谓“规则档案牌”，但用户仍直接评价为“丑死了”，要求交给其他模型重做。

因此，下面这些当前类名和 DOM 结构都不是设计约束，可以删除：

### 武器当前失败结构

- `.weapon-eyebrow`
- `.weapon-spec`
- `.weapon-primary`
- `.weapon-metrics`
- `.weapon-metric`
- `.weapon-facts`

### 护甲当前失败结构

- `.armor-eyebrow`
- `.armor-spec`
- `.armor-rating`
- `.armor-thresholds`
- `.armor-threshold`

不要从“怎么美化这些块”开始。先重新判断数据之间的主次、阅读顺序与留白用途，再写新的 JSX 和 CSS。

## 3. 绝对不能回归的问题

### 3.1 武器不得出现摘要行

旧武器标题区曾有：

```text
灵巧 · 近战 · 单手
```

它的类名是 `weapon-summary`。这些信息在正文数据区已经存在，属于重复信息。新的 Renderer 中：

- 不得重新加入 `weapon-summary`；
- 不得换一个类名把同一摘要重新放回标题区；
- 同一个字段不要在多个视觉区域重复展示。

### 3.2 不要把短特性拉成通高大框

特性只有一两行时，特性卡应保持内容高度或合理的最小高度。不要用 `flex: 1` 把边框拉到 footer 上方，形成大面积空框。

### 3.3 不要用等权三格表敷衍信息层级

武器的属性、距离、伤害并不必然同权；护甲值与两个伤害阈值也不是三个无差别统计值。设计应表达语义关系，而不是把所有字段平均分栏。

### 3.4 不要修改 Creator 预览来掩盖 Renderer 问题

卡面宽度、内部缩放、正文裁切或图片区高度错误，应在模板 Renderer 中修复。不要改 `AutoFitPreview` 来只让 Creator 中的截图看起来正常，因为同一 Renderer 还会被 Player、Market 和 GM Tabletop 使用。

## 4. 关键文件结构

### 4.1 主要修改文件

```text
packages/templates/src/frontend/
├─ weapon/
│  ├─ 1.0.0/
│  │  ├─ renderer.tsx          # 武器卡 JSX、CSS、Frame、三种展示模式
│  │  └─ authoring-editor.tsx  # Creator 字段编辑器，通常不需要改
│  └─ markdown.ts              # 武器 Restricted Markdown 的局部样式
└─ armor/
   └─ 1.0.0/
      ├─ renderer.tsx          # 护甲卡 JSX、CSS、Frame、三种展示模式
      └─ authoring-editor.tsx  # Creator 字段编辑器，通常不需要改
```

这次主要重写两个 `renderer.tsx`。除非设计确实需要调整 Markdown 容器的溢出行为，否则不要改 `markdown.ts`。不要修改 authoring editor 来迁就卡面排版。

### 4.2 数据定义与 Schema

```text
packages/templates/src/core/weapon/1.0.0/
├─ capability.ts
└─ schema.json

packages/templates/src/core/armor/1.0.0/
├─ capability.ts
└─ schema.json
```

这些文件定义权威字段。当前任务不要求增删字段、改 Schema 或迁移系统包。

### 4.3 Renderer 注册

```text
packages/templates/src/frontend/template-frontend-registry.ts
packages/templates/src/frontend/template-frontend-manifest.ts
packages/templates/src/frontend/renderer-registry.ts
packages/templates/src/frontend/index.ts
```

只重画现有 Renderer 时通常不需要修改这些文件。武器当前 Revision 是 `weapon-card-r2`，护甲是 `armor-card-r1`。除非任务明确要求发布新的不可变 Revision，否则不要自行改版本号并扩大范围。

### 4.4 共享卡面基础设施

```text
packages/resource-renderer/src/core.ts
packages/resource-renderer/src/react.tsx
```

重要组件：

- `CanonicalCardSurface`：把 Renderer 放入 Shadow DOM，并注入 Renderer 自有样式；
- `SingleLineTextFit`：主标题单行缩字，不使用省略号；
- `TextFitContainer`：固定比例卡正文溢出时缩字；
- `RestrictedMarkdown`：安全渲染特性描述；
- `CardFooter`：统一卡牌署名 footer。

Renderer 样式不会依赖 Creator 的全局 CSS。所有卡面 CSS 必须放进 Renderer 导出的 `styles` 字符串中。

### 4.5 Creator 预览链路

```text
apps/creator/src/workspace-prototype/creator-workbench.tsx
apps/creator/src/workspace-prototype/resource-preview.tsx
```

调用关系：

```text
Creator Workbench
  → TemplateRuntimePreview
    → AutoFitPreview
      → CanonicalCardSurface
        → weaponRendererRevision / armorRendererRevision
```

同一 Renderer 还由 Player、Market、GM Tabletop 使用，因此不得写 Creator 专属逻辑。

## 5. 字段清单与语义

### 5.1 武器 `WeaponData`

| 字段 | 含义 | 展示要求 |
| --- | --- | --- |
| `名称` | 中文名称 | 主标题，必须完整显示或缩字 |
| `原文` | 可选英文名称 | 为空时不渲染、不占位 |
| `类型` | 如主武器、副武器 | 需要展示一次 |
| `位阶` | 装备位阶 | 需要展示一次 |
| `属性` | 如灵巧、敏捷 | 核心规则数据 |
| `距离` | 如近战、远距离 | 核心规则数据 |
| `伤害` | 如 `d8+1` | 核心规则数据 |
| `伤害类型` | 如物理、魔法 | 规则数据 |
| `负荷` | 如单手、双手 | 规则数据 |
| `特性名` | 特性中文名 | 特性卡，保留现有逻辑 |
| `特性原名` | 可选特性英文名 | 空值不占位 |
| `特性描述` | 规则描述 | Restricted Markdown |
| `风味描述` | 可选风味文案 | 与规则描述区分 |

武器没有独立的“摘要”字段。不要把属性、距离、负荷再拼成标题区摘要。

### 5.2 护甲 `ArmorData`

| 字段 | 含义 | 展示要求 |
| --- | --- | --- |
| `名称` | 中文名称 | 主标题，必须完整显示或缩字 |
| `原文` | 可选英文名称 | 为空时不渲染、不占位 |
| `类型` | 通常为护甲 | 需要展示一次 |
| `位阶` | 装备位阶 | 需要展示一次 |
| `护甲值` | 可消耗护甲格相关数值 | 核心主值 |
| `重度伤害阈值` | 重度伤害阈值 | 与严重阈值有递进关系 |
| `严重伤害阈值` | 严重伤害阈值 | 与重度阈值有递进关系 |
| `特性名` | 特性中文名 | 特性卡，保留现有逻辑 |
| `特性原名` | 可选特性英文名 | 空值不占位 |
| `特性描述` | 规则描述 | Restricted Markdown |
| `风味描述` | 可选风味文案 | 与规则描述区分 |

## 6. 卡面尺寸与缩放机制

Canonical 设计尺寸是 `63 × 88`，定义在：

```ts
packages/resource-renderer/src/core.ts
canonicalCardDesignSize = { width: 63, height: 88 }
```

武器和护甲 Renderer 当前都采用同一套大画布方案：

```text
外层 Frame：63px × 88px
内层设计画布：360px × 502.857px
transform: scale(.175)
transform-origin: top left
```

原因是直接在 `63 × 88` 上设计会得到 `2px` 左右的正文和难以维护的微型 CSS。

Frame 逻辑位于各自 `renderer.tsx`：

- `WeaponCardFrame`
- `ArmorCardFrame`

固定比例时 Frame 高度必须是 `88px`，内层高度必须是 `502.857px`，溢出裁切。

非固定比例时：

- 内层卡面自然增高；
- `ResizeObserver` 读取内层 `offsetHeight`；
- Frame 高度更新为 `nativeHeight × .175`；
- 不要在百分比高度没有稳定参照时假设它仍与固定比例相同。

CSS `transform` 不参与普通文档流尺寸计算，所以不能删除 Frame 只保留 transform。

## 7. 三种展示模式

`presentation.mode` 只有：

```ts
"text" | "split" | "image"
```

### 7.1 `text`

- 无图片区；
- 显示标题、规则数据、特性与 footer；
- 不得给不存在的图片区预留空白。

### 7.2 `split`

- 图片从卡牌上边沿开始；
- 图片区当前约占卡面高度 `34%`；
- 标题位于图片下缘的深色渐变区；
- 图片下边沿就是标题/正文分界；
- 图片使用 `object-fit: cover`；
- 图片元素必须有明确宽高，并保留 `min-width: 0; min-height: 0; display: block`，防止固有尺寸撑高裁剪框。

纯文字与图文模式必须保持：

- 相同卡牌宽度；
- 相同正文宽度；
- 同一标题字号基线；
- 卡图不改变规则数据布局的横向尺度。

### 7.3 `image`

- 只显示图片；
- 不显示标题、正文、特性或 footer；
- 缺图时显示“缺少主图”；
- 不得因为保留不可见正文而影响尺寸。

## 8. 可以保留的特性区实现

用户要求“除了特性以外”重新设计，因此以下结构可直接保留：

### 武器

```tsx
{hasDescription ? <TextFitContainer
  className="weapon-description"
  contentKey={`${data.特性名}\0${data.特性原名 ?? ""}\0${data.特性描述}\0${data.风味描述}`}
  enabled={presentation.fixedRatio}
  minFontSizePx={11}
  maxFontSizePx={17}
  cssVariable="--weapon-content-font-size"
>
  {(data.特性名 || data.特性描述) && <section className="weapon-feature">
    <h2>
      <span><RestrictedMarkdown inline value={data.特性名 || "武器特性"} /></span>
      {data.特性原名?.trim() ? <small>{data.特性原名}</small> : null}
    </h2>
    <RestrictedMarkdown value={data.特性描述} />
  </section>}
  {data.风味描述 && <RestrictedMarkdown className="weapon-flavor" value={data.风味描述} />}
</TextFitContainer> : null}
```

### 护甲

结构与武器相同，类名使用 `.armor-effects`、`.armor-feature`、`.armor-flavor`，并在纯图片模式关闭正文拟合。

重要约束：

- `hasDescription` 为假时不要输出空的 `TextFitContainer`；
- 特性卡不要 `flex: 1` 拉满剩余空间；
- 拟合容器只测量真实特性/风味内容，不要把标题和核心数据一起放入正文拟合范围；
- 风味描述应弱于规则描述，通常使用较浅颜色和斜体。

## 9. 视觉设计自由度与最低标准

后续模型可以自由选择新的构图，不需要继承当前实验稿。但实现必须满足：

1. 第一眼能读出卡名和装备类别。
2. 第二眼能找到最重要的战斗数值。
3. 所有字段只展示一次，标签与值不会被误认。
4. 短内容不会全部挤在卡面上方，也不会制造一个有边框的巨大空箱。
5. 留白是构图的一部分，而不是剩余空间。
6. 武器与护甲可以采用不同信息结构，但必须明显属于同一视觉系统。
7. 与种族、社群共享材质、颜色和排版气质，不要求共享同一网格。
8. 长中文标题靠 `SingleLineTextFit` 缩字，禁止 `text-overflow: ellipsis`。
9. 标签字号在最终预览尺寸下仍可读，不要只在 360px 原生画布截图中判断。
10. 不要为了“丰富”而添加没有数据来源的图标、纹章、序号、英文或装饰文字。

建议先画两个最小线框再选方案：

- 武器：`匕首 / 位阶 1 / 主武器 / 灵巧 / 近战 / d8+1 / 物理 / 单手 / 无特性`
- 护甲：`埃伦德里安链甲 / 位阶 2 / 护甲 / 4 / 9 / 21 / 一条短特性`

线框应同时考虑“无特性”和“一条短特性”，不要只设计信息丰满的理想样本。

## 10. 测试文件

主要回归测试：

```text
tests/renderer/weapon-card.test.tsx
tests/renderer/armor-card.test.tsx
tests/renderer/shared-template-capabilities.test.tsx
tests/renderer/shared-card-preview-regressions.test.ts
```

测试覆盖：

- 字段是否全部渲染；
- 纯文字、图文、纯图片分支；
- Frame 与大画布缩放责任；
- 标题不使用省略号；
- 空特性不生成空容器；
- footer、卡图与 Renderer Revision；
- 武器视觉签名 SHA-256。

当前测试中有针对被否定实验结构的类名断言。重写 DOM 后应同步把这些断言改为新结构，但不要删除行为层断言。

视觉签名只能在以下条件满足后更新：

1. 新结构是有意设计的；
2. 定向测试除签名外全部通过；
3. 已检查实际静态 markup；
4. 最好已在真实 Creator 页面截图审阅。

不要看到 hash 失败就无条件复制新 hash。

定向验证命令：

```powershell
npm exec vitest run -- tests/renderer/weapon-card.test.tsx tests/renderer/armor-card.test.tsx tests/renderer/shared-template-capabilities.test.tsx tests/renderer/shared-card-preview-regressions.test.ts
```

完整验证入口：

```powershell
npm run verify
```

本机沙箱中的 Node 有时会报：

```text
EPERM: operation not permitted, lstat 'C:\Users\zinge'
```

这是已知沙箱边界，应原样申请在沙箱外重跑命令，不要因此修改代码或依赖。

## 11. 真实页面验收

先启动服务：

```powershell
node scripts/restart-dev.mjs
```

只有输出同时满足以下两项，才能报告服务启动成功：

```text
Backend 8001 OK
Platform 5173 OK
```

使用项目指定的 Browser 插件与 `node_repl` 验收 `http://localhost:5173/`，不要临时引入 Playwright 脚本或另一套浏览器自动化。

当前机器上的 Browser 控制存在已知阻塞：

```text
failed to write kernel assets: 系统找不到指定的路径。 (os error 3)
```

这发生在运行任何页面脚本之前，不代表页面或构建失败。若仍出现，应明确报告像素验收未完成，不要声称已看过页面，也不要换工具绕过项目规则。

### 验收矩阵

至少检查：

| 模板 | 内容 | 模式 |
| --- | --- | --- |
| 武器 | 短标题、无特性 | text |
| 武器 | 短标题、一条短特性 | text |
| 武器 | 长标题、一条长特性 | text |
| 武器 | 有真实卡图 | split |
| 武器 | 有真实卡图 | image |
| 护甲 | 短标题、一条短特性 | text |
| 护甲 | 长标题、一条短特性 | text |
| 护甲 | 有真实卡图 | split |
| 护甲 | 有真实卡图 | image |

每种情况检查：

- 标题完整，无省略号、无裁切；
- 卡牌 Frame 为 `63 × 88px`，内层为约 `360 × 503px`，transform 为 `.175`；
- 固定比例卡 `scrollWidth === clientWidth`、`scrollHeight === clientHeight`，或只存在允许的 1px 测量容差；
- 纯文字与图文正文宽度一致；
- 图片没有撑高裁剪框；
- 无特性时没有空特性容器；
- 纯图片时 footer 数量为 0；
- Shadow DOM 控制台无 `renderer.render.failed`、错误或警告；
- 最终预览尺寸下标签与数值可读，而不是只在放大的开发画布中可读。

## 12. 当前工作树注意事项

当前仓库不是干净工作树。与这次卡面任务相关的未提交修改包括：

```text
docs/handoff.md
packages/templates/src/frontend/armor/1.0.0/renderer.tsx
packages/templates/src/frontend/weapon/1.0.0/renderer.tsx
packages/templates/src/frontend/weapon/markdown.ts
tests/renderer/armor-card.test.tsx
tests/renderer/shared-card-preview-regressions.test.ts
tests/renderer/shared-template-capabilities.test.tsx
tests/renderer/weapon-card.test.tsx
```

不要运行 `git reset --hard`、`git checkout --` 或其他会覆盖用户修改的命令。可以直接替换两个 Renderer 中已经被否定的非特性 DOM/CSS，但应保留与大画布 Frame、图文裁剪、空特性、标题缩字和 footer 有关的修复。

开始工作前先运行：

```powershell
git status --short
git diff -- packages/templates/src/frontend/weapon/1.0.0/renderer.tsx
git diff -- packages/templates/src/frontend/armor/1.0.0/renderer.tsx
```

## 13. 推荐实施顺序

1. 阅读本文件、根目录 `AGENTS.md`、两个 Renderer 和四个相关测试文件。
2. 从字段语义出发画至少两个不同线框，不沿用当前 `spec` 结构。
3. 选定一个明确方向，同时设计武器与护甲，避免先做完一个再生硬套到另一个。
4. 保留 Frame、展示模式、图片裁剪、特性区、footer 与拟合边界。
5. 删除被否定的非特性 JSX/CSS，写入新结构。
6. 更新结构性测试，先跑定向验证。
7. 启动本地服务，用真实 Creator 页面截图、DOM 尺寸和控制台验收。
8. 视觉确认后更新武器签名，运行完整 `npm run verify`。
9. 更新 `docs/handoff.md`，明确记录完成项和任何未完成的浏览器验收。

## 14. 可直接交给下一位模型的任务描述

```text
请阅读 docs/card-face-redesign-guide.md 和根目录 AGENTS.md，然后重新设计并实现武器、护甲卡面。

用户已经否定当前工作树里武器/护甲的非特性视觉设计。不要继续美化现有 weapon-spec 或 armor-spec；删除并从信息架构开始重画标题与核心数据区域。保留大画布 Frame、三种 presentation mode、图片裁剪、特性卡、正文拟合、footer、Contract 和 Renderer Revision。武器不得恢复任何属性/距离/负荷摘要，也不得重复展示字段。

设计必须与种族、社群的暖骨纸、深褐、酒红、细金线语言一致，但不要照抄它们的网格。先同时考虑“无特性短武器”和“一条短特性的护甲”，让留白成为构图而不是剩余空间。

实现后更新相关结构测试，运行定向测试和 npm run verify。必须用项目 Browser 插件在真实 Creator 页面检查 text/split/image、长标题、溢出和控制台；如果 Browser 仍报 failed to write kernel assets，明确标记像素验收未完成，不得换临时 Playwright 或声称视觉已通过。
```
