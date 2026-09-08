# PbDH Sheet Player Migration

## 固定来源

- Repository: `PbDH_sheet`
- Commit: `0e44fa69b12209c172e4189e273615ba3a4d07a6`
- Local evidence path: `D:\Fish\TRPG\PbDH_sheet`

该 commit 是本轮完整 Player 能力迁移的固定证据。后续来源仓库更新不会自动进入 PbDH；再次同步必须单独记录新 commit 和迁移内容。

## 目标

新 Player App 迁移旧 Sheet 已成熟的 System Package 激活、动态人物卡、Sheet Modules、依赖计算、资源选择、角色存档工作流、检查、导入导出、打印和本地优先行为。新平台继续拥有全局外壳、账号、云文档、媒体、资源模板、`.pbres` 与共享 Tabletop。

## 路径映射

| PbDH_sheet source | PbDH owner | 处理 |
| --- | --- | --- |
| `src/domain/**` | `apps/player/src/sheet-runtime/domain/**` | 迁移行为与测试；Contract 类型改为消费平台 Schema |
| `src/loaders/**` | `apps/player/src/sheet-runtime/loaders/**` | 迁移目录/ZIP 归一化、资产解析和 System Package 加载 |
| `src/rendering/**` | `apps/player/src/sheet-runtime/rendering/**` | 迁移 SheetRenderer、Module Registry、检查和输出界面 |
| `src/store/**` | `apps/player/src/sheet-runtime/store/**` | 迁移 Runtime 状态和工作流；持久化改接正式 Repository |
| `src/export/**` | `apps/player/src/sheet-runtime/export/**` | 迁移当前 Contract 仍需要的输出行为 |
| `public/system-packages/daggerheart-core/**` | `apps/player/public/system-packages/daggerheart-core/**` | 已完成迁移的正式 System Package；由 Platform Vite 静态提供 |
| System Package Resource Libraries | `apps/player/public/system-packages/daggerheart-core/resources/*.pbres` | 原生 Resource Package；资源文本、卡图和卡背不再保留第二套迁移副本 |
| Runtime Resource Library adapter | `apps/player/src/sheet-runtime/adapters/platformResourceLibraries.ts` | 按 Template Compatibility 将已安装 `.pbres` 投影为 Sheet Runtime 只读资源库；不形成第二份持久数据 |
| `src/storage/storageService.ts` | `apps/player/src/character-saves/**` 与 Player adapters | 只迁移行为；不复制 schema、键或旧记录格式 |
| `src/rendering/app/AppTopBar.tsx` | `apps/player` Surface + `packages/platform-ui` | 迁移菜单能力；不复制旧顶栏结构和视觉实现 |
| `src/App.tsx`, `src/main.tsx` | `apps/platform` + Player Surface | 只迁移组合行为，不复制独立应用入口 |

未列出的发布、部署、PWA、旧仓库脚本和项目配置不迁移。

## Contract 取舍

- 当前开发版本允许直接形成新的 System Package 与 Character Save Contract，不承诺读取旧 Sheet 文件或浏览器数据。
- System Package 的 JSON Schema 是唯一权威；旧 Zod schema 只用于提取约束、诊断和 conformance fixtures。
- 系统包自带游戏资源与 Creator/Market 资源使用同一个 Resource Package Contract。构建时生成 `.pbres`，Player 启动后通过正式资源仓储安装或更新，不建立隐藏的第二资源目录。
- 角色存档保存最终 Character Data 与自包含玩家桌面实例，不保存 Resource Package、资源选择或依赖来源。
- 原生人物文件使用 Character Save Contract 的 `.pbcha`；不读取旧 Sheet Character Data JSON 或旧 `.pbcha` 临时 Profile。
- Sheet Runtime 条目 ID 使用 `Resource Package ID + 包内 Resource ID`，避免不同资源包的同 ID 条目互相覆盖；该 ID 只存在于运行投影中。
- `.pbres` 媒体在 Runtime 投影中使用确定性虚拟路径，实际字节继续由已安装资源仓储拥有，渲染时才产生浏览器 Object URL。

## 当前进度

- Daggerheart Core 已生成为单个 `daggerheart-core.pbres`，包含 625 个资源和 280 个唯一媒体资产；`.pbres` 不再受压缩归档总字节数限制。
- Player 首次加载会安装缺失的内置资源包；相同摘要保持幂等，更高本地版本不会被预置包覆盖。
- 迁移后的 System Package loader 已能用上述单个 `.pbres` 组装通过旧 Runtime 完整校验的 8 个资源库，不再读取旧 `resources/*.json`。
- Platform Player Surface 已挂载完整 `SheetRenderer`、人物列表、自动保存、创建向导、问卷创建、打印与当前资源管理器；不复制旧独立顶栏。
- Runtime Storage 已接入正式 Character Save Repository；人物字段、自包含桌面副本和媒体按同一 revision 保存，云恢复后缺少来源 `.pbres` 仍可显示、复制和再次保存。
- 登录前本地人物通过显式“同步到云”进入云端；登录后新建或导入人物进入 outbox。账号切换、冲突三动作、云端删除与回收站使用统一 Cloud Document Service。
- Player 图片入口已改用共享媒体准入流程，在用户裁剪后归一化为内容寻址 WebP。
- Daggerheart Core 的 34 份护甲以及剩余 399 份种族、社群、职业、子职业、物品和领域卡已从固定来源迁移到各自可信 `1.0.0` Template；资源 ID、路径、字段文本和媒体保持不变，内嵌 Resource Package 提升到 `1.0.7`。开发期版本已移除，不再读取或升级。
- 六类稳定化证据固定为 `PbDH_sheet@0e44fa69b12209c172e4189e273615ba3a4d07a6`，原路径分别为 `public/system-packages/daggerheart-core/resources/ancestries.json`、`communities.json`、`classes.json`、`subclasses.json`、`loot.json` 与 `domain-cards.json`。迁移来源继续由旧仓库和固定 commit 保存；本仓库只保留已迁移完成的 System Package 与 `.pbres`，不再提交第二套旧格式资源和卡图。

## 2026-09-08 增量同步

- 来源：`PbDH_sheet@fe1de3f`（2.3.0），比较基线仍为 `0e44fa69b12209c172e4189e273615ba3a4d07a6`；旧仓库只读。
- `public/system-packages/tttri/` 下的升级模块、检查、引导、布局、问卷及 `adapters/scripts/character-{import,export}.js` 迁入本项目同名系统包目录；保留当前资源选择器与平台适配。
- `resources/subclasses.json` 按稳定 ID 增量更新至 `resources/tttri.pbres`：新增 40 项；既有资源只更新上游变化字段及对应结构化特性，保留其他卡面、媒体和 ID。系统包与原生资源包独立升版。
- `src/domain/characterData.ts` 的勾选项兼容行为迁入 `apps/player/src/sheet-runtime/domain/characterData.ts`：导入时丢弃无效旧选项并警告，保留有效勾选；不建立旧 Sheet 存档直接读取通道，不修改数据库 schema。
- 平台原生 TTTRI Character Data 从 `1.0.0` 升至 `1.1.0`，通过已有版本升级流程执行包内 `adapters/scripts/upgrade-advancement.js`；只移除废弃领取选项、给第二格技艺交流补默认未选中值，不改其他升级、特性、数值。系统包 `1.1.0`，资源包 `2.1.0`。
- 验证覆盖新增分支、晋升奖励、两格技艺交流、规则勘误、原生资源加载及旧勾选保留。旧源测试 `src/test/tttri{Package,Validation,CharacterFormatAdapter}.test.ts` 作为行为证据，在当前 Player 测试中重建断言。
- 可重放生成入口：`npx tsx scripts/sync-tttri-sheet-update.ts D:/Fish/TRPG/PbDH_sheet`，之后运行 `npx tsx scripts/sync-bundled-system-package-metadata.ts`。脚本只读固定 Git 提交，不依赖源仓库工作区，也不复制其发布配置。
- 结果：新增 40 项、更新 17 项；568 个资源、281 个媒体，归档 25,149,368 bytes。全量前端 111 文件/911 测试、类型检查、内置包一致性和构建通过。真实本地 Player 显示 TTTRI 1.1.0，子职选择器 280 项，排陷手包含五个阶段。完整 `verify` 被既有 `.pytest-native` 目录权限错误阻断，未记为通过；尚未人工确认真实旧人物升级。

## 阶段验收清单

1. Daggerheart Core 通过迁移后的加载器、Validator 和 SheetRenderer 显示完整人物卡。
2. 系统包菜单与资源管理器恢复旧 Sheet 的功能分工，并挂载到统一 Platform App Bar。
3. Daggerheart Core 自带资源由 `.pbres` 安装，并按 Template Compatibility 进入原生资源入口。
4. 人物字段修改自动写入正式 Character Save Repository；切换存档和系统包前刷新待保存内容。
5. 刷新、离线重启、云恢复、缺少来源资源包和冲突处理满足当前 Character Save Contract。
6. 迁移测试、平台边界检查、设计检查、TypeScript/Python 测试、类型检查和 Platform build 全部通过。
