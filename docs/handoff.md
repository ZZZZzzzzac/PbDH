# PbDH 开发交接

更新时间：2026-09-01

## 本轮目标

把 11 个第一方 Resource Template 的 Creator 编辑区与卡面视觉从平台声明式通用控件迁移为模板自有的 React/HTML/CSS，并先完成“敌人”模板的视觉调整。用户明确不考虑第三方模板。

## 当前结论与不可回退的边界

- 模板自己拥有编辑区结构、字段布局、控件选择和卡面 DOM/CSS；平台只挂载模板能力，不理解字段语义，也不硬编码模板 UI。
- 不再使用 OpenPencil。前端 JSX/HTML/CSS 是唯一视觉源，相关 `.op`、生成物与同步脚本已从工作树移除；`scripts/check-visual-sources.mjs` 会阻止重新引入双视觉源。
- 模板 JSON 字段结构或可输入字段集合发生兼容性变化时才需要新版本；字体、间距、颜色、布局等视觉修改不因此发布新版本。
- 11 个模板的 `1.0.0` 发布过早，当前已全部从 `published` 切回 `development`。参见：
  - `docs/adr/0066-let-trusted-templates-own-authoring-editors.md`
  - `docs/adr/0067-return-first-party-resource-templates-to-development.md`
  - `docs/adr/0068-use-frontend-code-as-the-only-visual-source.md`
- 后续视觉修改默认只能改模板。若需求只能通过平台实现，先说明原因和最小改动范围，等待用户授权。本轮用户仅额外授权了卡面模式工具栏“图+文”按钮去除定宽。

## 当前工作树

- 分支为 `main`，存在大量未提交改动；不要清理、还原或覆盖这些改动。
- `git status --short` 是当前修改清单的权威，不在本文件复制完整列表。
- 核心迁移文件位于：
  - `packages/templates/src/frontend/*/1.0.0/authoring-editor.tsx`
  - `packages/templates/src/frontend/authoring-primitives.tsx`
  - `packages/templates/src/frontend/authoring-surface.tsx`
  - `packages/templates/src/frontend/template-frontend-registry.ts`
  - `packages/templates/src/frontend/types.ts`
- 平台不再持有模板字段布局；ADR、README、roadmap 与测试已有配套修改，具体内容直接看 diff。

## 敌人模板已完成

编辑区：`packages/templates/src/frontend/adversary/1.0.0/authoring-editor.tsx`

- 位阶：`1 / 2 / 3 / 4` 下拉建议。
- 种类：`斗士 / 集群 / 头目 / 杂兵 / 远程 / 潜伏 / 社交 / 独狼 / 标准 / 辅助`。
- 范围：`近战 / 邻近 / 近距离 / 远距离 / 极远`。
- 攻击类型：`物理 / 魔法`。
- 特性类型：`动作 / 被动 / 反应`。
- 下拉入口使用 CSS 三角形，无外框；浏览器实测已经垂直居中。
- 编辑区字体与控件已放大，布局使用响应式 grid/flex，不给输入框固定宽度。
- 特性“清空”“删除”按钮与输入框均为 `34px` 高，浏览器实测上下边缘一致。
- “换卡”整栏已移除。

卡面：`packages/templates/src/frontend/adversary/1.0.0/renderer.tsx`

- 生命点、压力点的 GM 操作在卡面图标上完成；点击空心/实心图标切换状态，不再有预览工具栏。
- 生命与压力图标分别使用两套 SVG 填充状态，间距一致。
- 特性类型与名称处于同一信息组，但类型字号和颜色稍弱；英文名独立置于下方。
- 修复了标题、正文和控件文字裁切。
- “纯文字”与“图+文”共用同一 DOM；纯文字通过 `--enemy-media-height: 0px` 去掉图片区并把标题上移到卡片顶部。
- 非固定比例下：
  - 图+文保留 `568px` 原生最小高度，内容超过时增长。
  - 纯文字按实际正文内容收缩。当前浏览器样例原生高度为 `474px`，图+文为 `570px`。
  - 纯图片通过 `height: auto` 按图片自身比例撑开，不继承图文卡最小高度。
- 当前 Browser 验收资源没有设置卡图，因此纯图片“真实图片比例”只由 CSS 与测试确认，尚未在本地页面用实际图片复验。

平台工具栏的已授权例外：

- `apps/creator/src/workspace-prototype/workspace.css` 已删除第二个卡面模式按钮的 `width: 82px`。
- 浏览器实测按钮宽度：纯文字 `49px`、图+文 `44.5px`、纯图片 `49px`；均由文字宽度加左右各 `8px` 内边距决定。
- 文案“半图半文字”已改为“图+文”。

## 验证状态

- 最新 `npm run verify` 通过：
  - TypeScript：95 个测试文件、684 项测试。
  - Python：141 项测试。
  - 依赖边界、Contract release、唯一视觉源检查、类型检查、Renderer 性能测量与 Platform 构建均通过。
- `git diff --check` 通过；输出只有现有 CRLF/LF 提示。
- Python 仍输出既有 Pydantic/FastAPI deprecation 警告；Platform 构建仍有入口 chunk 大于 500 KiB 的提示，本轮未处理。
- 本轮没有重新运行 `node scripts/restart-dev.mjs`；浏览器连接到现有 `http://localhost:5173/creator` 并完成真实 DOM、尺寸测量和截图验收。

## 下一步建议

1. 若继续调整敌人模板，先在真实 Creator 页面复现，再只修改敌人模板；平台能力不足时先向用户说明并等待授权。
2. 找一张已设置卡图的敌人资源，复验非固定“纯图片”是否严格贴合图片固有比例且无底部空白。
3. 用户确认敌人模板后，再逐个处理其余 10 个模板；不要一次批量猜测视觉方案。
4. 每个模板完成后至少运行对应定向测试、浏览器视觉验收，最后运行 `npm run verify` 与 `git diff --check`。

## Suggested skills

- `$ui-ux-pro-max`：实现或审查每个模板的布局、控件尺寸与视觉细节。
- `$browser:control-in-app-browser`：必须用于真实 Creator 页面截图、DOM 和像素尺寸验收。
- `$diagnosing-bugs`：仅在出现裁切、错误高度、状态不同步或测试失败时进入诊断循环。
- `$code-review`：整轮模板迁移完成后审查边界、测试与无关改动。
- `$handoff`：下一轮结束时更新本文件。

## 操作提醒

- 遵守根目录 `AGENTS.md`；默认中文沟通。
- 完整验证入口是 `npm run verify`。
- 不得直接删除文件；需要清理时移入回收站。
- 不修改 `.env`、密钥、CI/CD、数据库 schema，不执行 push/rebase/reset。
- Browser 插件与本地开发服务当前可用；不要改用临时 Playwright 服务。
