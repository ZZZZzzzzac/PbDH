# Bundled System Package Rules

## 资源权威

- 除 `daggerheart-core/AGENTS.md` 另有规定外，各系统包 `resources/*.pbres` 是内置资源的唯一权威源。
- 小规模资源修改使用卡牌工坊导入、编辑并导出 PBRES，随后替换对应文件。
- 批量修改先用 `npm run pbres:unpack -- <包.pbres>` 生成临时可编辑目录，修改其中的资源 JSON，再用 `npm run pbres:pack -- <目录>` 自动递增版本、更新逻辑快照摘要、校验并重建归档；不得把解包目录提交为平行资源源。
- 预设只用稳定路径和包 ID 定位内置 PBRES，不固定资源版本或摘要；替换 PBRES 不需要同步代码索引。
- TTTRI 当前还有一份 `apps/player/src/tttri-legacy-resources.generated.json`，仅补充现有 PBRES 尚未携带的系统专属人物卡字段；PBRES 中已有的字段始终优先。将这些字段正式加入 PBRES 后必须删除该临时投影。

## 系统包运行文件

- 本目录内 `system.json`、页面、模块、依赖、布局、皮肤与运行时资产是各 System Package 的作者源，直接维护。
- `apps/player/src/*-system.generated.json`、`*-preset.generated.json` 与 `.pbdh-runtime-files.json` 是派生元数据，不手工维护；其中 PBRES 索引只包含稳定路径和包 ID。
- `npm run check:builtin-system-packages` 校验系统运行文件的派生元数据是否同步，不比较 PBRES 版本或摘要，也不修改文件。

## 验证

- 修改 PBRES 后直接运行根目录 `npm run verify`；修改系统运行文件后先运行 `npm run sync:builtin-system-packages`。
