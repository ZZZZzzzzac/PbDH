# 开发交接

整理日期：2026-09-11。**v0.1.18 已发布并部署到正式站点**，回执见下文。历史可从 Git 查询，发布与恢复操作见 [部署说明](../deploy/README.md)。

## v0.1.19 发布准备

- 合并 v0.1.18 的工作区优先保护；删除不再以同步 clean 为前提，三类文档共享独立删除流程，本机快照保留在本地回收站。
- 修复首次上传与删除竞态、断网/会话/版本冲突重试与请求超时。Creator 云端旧删除记录仍只暂停同步，不主动隐藏工作区；用户显式删除才移入回收站。
- 合并后验证：142 个 TypeScript 测试文件、1,270 个测试与 170 个 Python 测试通过；v0.1.19 等待发布及正式部署。

## v0.1.18 修复（工作区优先）

- 工作区优先：`saveImported` 可原子替换本机同 ID 的 trash 文档；普通 `save` 不可复活已删除文档。
- 云端同 ID 删除记录只暂停 Creator 工作区同步，不删除本机资源包。
- 资源包回收站恢复不覆盖已有活动工作区。
- 完整文档信封在事务内比较，拒绝过时快照的覆盖与删除。
- `mergeWorkspaceSnapshot` 按 baseline 与指定目标接纳：保留新编辑与新建，不复活请求期间删除；GM 快照不改 workspace。
- 异步 `export/publish/upgrade/image/metadata` 结果不覆盖其后的编辑。
- 编辑立即排队，flush 后执行云动作；导入新建保存成功后再显示；初始读取失败不置 ready。
- 回收站 6 个独立来源、部分失败仍显示其余、失败禁用全部删除、不显示假空、15s 超时重试与来源阶段中文诊断、到期清理同事务防重复。
- 无 schema 更改，无迁移。

## 验证状态

- 本轮最终 `npm run verify` 通过：142 个 TypeScript 测试文件、1,251 个测试，170 个 Python 测试；依赖边界、Contract、类型检查、渲染测量与前端构建均通过。
- 回归入口：`tests/creator/creator-workspace-repository.test.ts`、`cloud-document-service.test.ts`、`workspace-persistence.test.tsx`、`workspace-snapshot.test.ts`，以及 `tests/local-storage/local-document-store.test.ts`、`tests/platform-ui/platform-trash.test.tsx`。
- 本地真实工坊页面可加载；未用真实账号数据执行破坏性验收。

## 最近交付与未结事项

- 历史记录：v0.1.14（`bdd755f`）曾记录为最近部署，修复 dhsheet 资源包导出的名称声明、施法值及变体效果；该部署声明降级为历史记录保留。回归入口 `tests/resource-conversion/resource-conversion.test.ts`。
- 上游严格校验器曾通过 1,004 张卡，尚未收到用户在 dhsheet 页面实际导入成功的反馈。若继续报错，核对是否刷新后重新导出并收集具体报错；不依赖已清理的本机临时修正版和脚本。dhsheet 需求未结。
- 旧记录中的云端 Creator Workspace `contract.schema.invalid` 尚无明确关闭证据；再次遇到时按真实文档复现，不放宽校验绕过。
- 大量卡牌的 PDF 预览卡顿按用户要求暂缓；分页末行已在此前完成成品验收。
- 历史幂等回执压缩没有执行；`scripts/compact-cloud-receipts.py` 保留。执行数据处理仍需单独授权和备份。

## 残余风险

- 用户 Edge 原 `UnknownError` 底层未真实复现，只复现并修复了并发清理与错误放大。
- 本机旧 GM 文档 `Invalid stored Tabletop Document: contract.version.unsupported` 未修复未清理。
- 已永久丢失的数据不会自动恢复。
- 线上已核对版本、前端制品与 API 健康状态；未使用真实账号数据执行删除、重新导入或冲突恢复验收。

## 发布状态

- 修复提交 `f529e7a1a5f1d91a4166efe7de82718c15cb0441` 已推送 `main`，标签 `v0.1.18` 指向该提交。
- [Release 工作流](https://github.com/ZZZZzzzzac/PbDH/actions/runs/34590216167) 成功：Linux 完整验证、双基路径构建与不可变制品发布完成。
- [Deploy Release 工作流](https://github.com/ZZZZzzzzac/PbDH/actions/runs/34590462030) 成功，使用既有备份与原子切换流程；[发布版本](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.18)。
- 独立线上检查：[正式首页](https://daggerheart.cn/pbdh/) 与引用的 JavaScript 制品均为 HTTP 200；页面版本 `0.1.18`，制品包含 `saveImported` 与 `TRASH_ACTIVE_WORKSPACE_EXISTS`；`/api/health` 返回 `status: ok`、`service: pbdh-platform-api`。

## 运维边界

- 2026-09-09 记录已完成正式域名切流与最终一致性同步。旧服务器应用已停用；不可直接重启旧应用回滚，否则会分叉数据。
- 最终私有归档记录为 `/srv/domain-migration-20260909/final/snapshot.tar.gz`，SHA-256 为 `44553c07255cbd12c6db00b9ae3a14cc6a2ca5c7e3d70cc5dc96c93b9f7e016a`；旧机和恢复前备份未在本次清理范围内。
- 域名迁移时未做真实账号登录验收；既有 HTTP 健康检查不能代替这一项。
- 本地 `.scratch/runtime` 含数据库，`.scratch/dev-servers` 含服务日志与历史运行目录，本次均保留。它们不是可直接清空的普通草稿。
