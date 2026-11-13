# 更新日志

记录已成功部署的版本。时间为北京时间（Asia/Shanghai），以部署工作流完成时间为准。
代码 commit 以 Release tag 指向的提交为准，不以部署工作流的 `headSha` 代替：重新部署旧版本时，工作流可能使用更新的部署脚本。

`v0.1.28`–`v0.1.51` 于 2026-11-13 依据 tag、GitHub Release / Deploy Release 运行记录与提交历史补记；这些版本的 Release 构建与部署记录均为成功，未保留当时的人工验证细节。

## v0.1.51 — 2026-11-13 10:47:23

- 状态：已部署，公网版本与 API 健康检查通过。
- 代码 commit：[adaf40e](https://github.com/ZZZZzzzzac/PbDH/commit/adaf40e09e655cdb98affdc8c2050f635553f9a4)。
- 上一部署：`v0.1.50` / `c3f7922`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.51) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/43354163263) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/43354514981)。

### 修复

- 导出独立人物 HTML 时保留头像：头像图片原本嵌在「更换/上传」按钮内，旧逻辑统一删除按钮导致图片一起被删；现在先移出图片，再清理按钮与文件选择框。
- 补充导出规则回归测试，以及用真实头像组件渲染后导出的端到端测试。

### 验证

- 本地 `npm run verify` 通过（完整 TypeScript、Python 测试与生产构建）。
- Release 工作流完成完整验证与双基路径构建；Deploy 工作流完成制品摘要核对、启动与公网版本校验。
- 部署后 `/pbdh/` 版本为 `0.1.51`，`/api/health` 返回 `ok`。

## v0.1.50 — 2026-11-12 14:10:50

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[c3f7922](https://github.com/ZZZZzzzzac/PbDH/commit/c3f7922d9efdfe03badbf480e956bc6f90f615c3)。
- 上一部署：`v0.1.49` / `a1f462b`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.50) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/43165837259) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/43166246961)。

### 新增与调整

- 资源选择器的搜索与筛选条件按人物存档保存，切换存档后恢复上次条件。

## v0.1.49 — 2026-11-12 11:37:28

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[a1f462b](https://github.com/ZZZZzzzzac/PbDH/commit/a1f462b89ecc9d8d7013dd7f14079734bbb3a4a2)。
- 上一部署：`v0.1.48` / `52c4e5d`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.49) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/43148990855) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/43149377937)。

### 修复

- 职业模板的纯图卡固定为 63:88 显示比例，避免卡面被拉伸或留白。

## v0.1.48 — 2026-11-11 14:31:35

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[52c4e5d](https://github.com/ZZZZzzzzac/PbDH/commit/52c4e5deca6581b22032f34eb95eae82b5a168cc)。
- 上一部署：`v0.1.47` / `e9f5561`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.48) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/42971103483) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/42972939291)。

### 新增与调整

- 新增「三灯」系统包 0.1.0：阳气、阴气与三盏灯的人物卡草稿。
- 同步 persona-heart（潜相心影：都市异闻录）系统包到 0.1.14，含依赖声明、0.1.5→0.1.6 迁移与资源包更新。

### 修复

- 自由字段名称改为失焦时提交，避免输入过程中反复改名。

## v0.1.47 — 2026-10-30 11:33:04

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[e9f5561](https://github.com/ZZZZzzzzac/PbDH/commit/e9f5561bfc23647180b12f6426e6cb23c71724b1)。
- 上一部署：`v0.1.46` / `9b2ab3e`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.47) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/40997611377) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/40997963980)。

### 修复

- 本地加载接受手工解压重封的资源包：按内容重算图片标识、字节数与内容摘要，不再要求使用仓库工具重新打包。
- 发布时按实际像素更新图片宽高，媒体规则只保留「图片可解码为 WebP」与「封面 630×880」两条。
- 资源包校验文案按诊断代码补齐具体原因与位置；版本冲突显示分类原因与最低版本号。

## v0.1.46 — 2026-10-29 22:17:55

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[9b2ab3e](https://github.com/ZZZZzzzzac/PbDH/commit/9b2ab3eba590f421681bacb933c64fc3c3ce19a3)。
- 上一部署：`v0.1.45` / `578b70c`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.46) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/40889518877) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/40889985580)。

### 修复

- 附加车卡页按存档中的职业字段重建，重新载入存档后不再丢失。

## v0.1.45 — 2026-10-29 21:40:10

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[578b70c](https://github.com/ZZZZzzzzac/PbDH/commit/578b70c76472d5f667f6552dd49f6b56bbcdca6c)。
- 上一部署：`v0.1.44` / `b8d4dd1`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.45) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/40883518244) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/40883968222)。

### 修复

- 启动时先配置运行时依赖，再等待异步初始化，避免首屏期间依赖尚未就绪。

## v0.1.44 — 2026-10-28 14:41:43

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[b8d4dd1](https://github.com/ZZZZzzzzac/PbDH/commit/b8d4dd19c76e273106af31d4a0a0073bca5530c5)。
- 上一部署：`v0.1.43` / `6399330`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.44) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/40644957715) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/40645355064)。

### 新增与调整

- 资源管理器可直接禁用原生资源包。

## v0.1.43 — 2026-10-28 13:58:45

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[6399330](https://github.com/ZZZZzzzzac/PbDH/commit/63993307097ff244e0e8d5b4795923914ad32173)。
- 上一部署：`v0.1.42` / `fe2fe10`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.43) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/40640722997) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/40641025787)。

### 新增与调整

- 玩家可以禁用原生（内置）资源包。

## v0.1.42 — 2026-10-18 15:16:57

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[fe2fe10](https://github.com/ZZZZzzzzac/PbDH/commit/fe2fe1042c02df5f2344d3fa7dc1ec66e1798f6f)。
- 上一部署：`v0.1.41` / `198a1d2`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.42) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/39106895278) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/39107045122)。

### 新增与调整

- Market 支持把资源包直接导出为第三方格式，并展示转换报告与诊断。

## v0.1.41 — 2026-10-16 23:29:09

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[198a1d2](https://github.com/ZZZZzzzzac/PbDH/commit/198a1d226e6a4969510e357a42a7094418a134c6)。
- 上一部署：`v0.1.40` / `c28ec1a`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.41) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/38923801689) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/38924237148)。

### 修复

- 资源包从本地移除后仍可从市场重新安装。

## v0.1.40 — 2026-10-16 15:40:04

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[c28ec1a](https://github.com/ZZZZzzzzac/PbDH/commit/c28ec1a50b4a5de1d70aa83826ec714fedbc76cb)。
- 上一部署：`v0.1.39` / `2997744`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.40) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/38868215314) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/38868615248)。

### 新增与调整

- Creator 把 dhcb 导出拆分为卡牌包与装备包。
- 桌面统一可翻面卡背：翻面保留同一实例、状态、指示物与布局，再翻一次回到正面（ADR 0082）。
- 新增 persona-heart 系统包 0.1.12，`docs/third/` 下提供源码与 `.pbsys`。
- 清理已转换材料，开发中的系统包源码继续保留在仓库。

## v0.1.39 — 2026-10-15 13:44:03

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[2997744](https://github.com/ZZZZzzzzac/PbDH/commit/29977448f343eb3f95ae50074d52d8c975fd9304)。
- 上一部署：`v0.1.38` / `9cfb0ec`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.39) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/38687970920) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/38688337924)。

### 修复

- 把渲染异常隔离到单页或单模块，单个模块失败不再让整张车卡不可用。
- 修复图片更新触发的循环刷新。

## v0.1.38 — 2026-10-14 21:26:59

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[9cfb0ec](https://github.com/ZZZZzzzzac/PbDH/commit/9cfb0ec491058c07465acd92f2ac97b9fbc4f2d3)。
- 上一部署：`v0.1.37` / `cc276ad`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.38) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/38571330600) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/38571796221)。

### 修复

- 支持 HTTP 页面中的 SealChat 嵌入：WebCrypto 不可用时，摘要与 UUID 使用兼容实现，存档格式不变（ADR 0081）。

## v0.1.37 — 2026-10-14 14:27:28

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[cc276ad](https://github.com/ZZZZzzzzac/PbDH/commit/cc276ad46958e7e3f055ec74032c15fe4ddb73a6)。
- 上一部署：`v0.1.36` / `033d04a`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.37) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/38521892079) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/38522260966)。

### 修复

- DHOL 角色投递改走 Pages API，修复投递失败。

## v0.1.36 — 2026-10-14 00:23:36

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[033d04a](https://github.com/ZZZZzzzzac/PbDH/commit/033d04a52dcd7ea8f061e396192c7650abfa014e)。
- 上一部署：`v0.1.35` / `b8f6a05`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.36) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/38429662324) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/38430055500)。

### 新增与调整

- DHOL 投递对话框可直接打开房间链接。

## v0.1.35 — 2026-10-13 23:14:04

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[b8f6a05](https://github.com/ZZZZzzzzac/PbDH/commit/b8f6a0599c80fcc264adec73b89c29a1ade052cd)。
- 上一部署：`v0.1.34` / `4f5f7e4`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.35) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/38419686542) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/38420202473)。

### 新增与调整

- 新增 DHOL 角色投递，可把人物卡发送到在线面板。

### 修复

- 从伤害字段保留 DHOL 主副武器属性。

## v0.1.34 — 2026-10-12 15:08:24

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[4f5f7e4](https://github.com/ZZZZzzzzac/PbDH/commit/4f5f7e449313dc325f700764fff0d53d2b187e87)。
- 上一部署：`v0.1.33` / `8ce06e4`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.34) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/38215689401) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/38216056056)。

### 新增与调整

- 新增匕首心随机车卡，生成结果经过规则审核。

## v0.1.33 — 2026-10-05 12:09:58

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[8ce06e4](https://github.com/ZZZZzzzzac/PbDH/commit/8ce06e4003eef3a25bab3953cc42bac81d13e47d)。
- 上一部署：`v0.1.32` / `f6261fa`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.33) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/37261849099) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/37262282698)。

### 新增与调整

- 完成 SealChat iframe 集成：频道嵌入窗内关联人物存档并建立资源会话，闪避与伤害阈值同步为骰子徽标，特质点击可打开骰子助手，试骰与伤害助手使用武器名和可解析伤害。
- 连接菜单与 Embed 设置在 Market 之间保留；嵌入预览支持官方云 API。

### 修复

- 重连已关联人物时不再重新初始化 Dice；人物名不再依赖原始 `st` 字段解析。

## v0.1.32 — 2026-10-03 19:39:47

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[f6261fa](https://github.com/ZZZZzzzzac/PbDH/commit/f6261fa3157288693039dcff196e5e4f1740fa2e)。
- 上一部署：`v0.1.31` / `3c000ee`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.32) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/37120148611) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/37120343827)。

### 新增与调整

- 海豹骰导出补充经历字段，金币按独立数量导出。

## v0.1.31 — 2026-10-03 14:21:26

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[3c000ee](https://github.com/ZZZZzzzzac/PbDH/commit/3c000eefcc35d244b70e633f072db4bea25bf233)。
- 上一部署：`v0.1.29` / `8427c39`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.31) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/37102607561) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/37102753553)。

### 修复

- 过滤第三方职业领域，避免非本系统领域混入。
- 海豹骰导出写出属性赋值。

### 新增与调整

- 加入 MIT 许可证。

`v0.1.30` 的 Release 构建被取消、未部署，其内容随本版一起上线。

## v0.1.29 — 2026-09-29 15:28:14

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[8427c39](https://github.com/ZZZZzzzzac/PbDH/commit/8427c396f52a6ac566492ef0f54825e5ce1e8c4d)。
- 上一部署：`v0.1.28` / `c59e936`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.29) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/36536394918) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/36536750523)。

### 修复

- 从共享入口进入时保留已上传的系统包。

## v0.1.28 — 2026-09-28 14:13:30

- 状态：已部署（依据 Release 与 Deploy 运行记录补记）。
- 代码 commit：[c59e936](https://github.com/ZZZZzzzzac/PbDH/commit/c59e9367c4af3f86a0b192420ed5bdd1cdcf643d)。
- 上一部署：`v0.1.27` / `f9d7c53`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.28) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/36385061804) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/36385353563)。

### 修复

- 基德（Kid）格式导出补齐多卡 ZIP 与可读属性。

### 新增与调整

- PDF 导出按卡牌顺序排列。

## v0.1.27 — 2026-09-25 19:30:21

- 状态：已部署，公网版本与 API 健康检查通过。
- 代码 commit：[f9d7c53](https://github.com/ZZZZzzzzac/PbDH/commit/f9d7c532fcec951fb0dc222276b9eaf9a8502d58)。
- 上一部署：`v0.1.26` / `eda0d0d`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.27) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/36129355634) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/36129696493) · [完整差异](https://github.com/ZZZZzzzzac/PbDH/compare/v0.1.26...v0.1.27)。

### 新增与调整

- 寻望之心系统包 1.0.3：A4 背包页、并排手上区与主背包、三档容量、固定格长、完整落点预览、拖放与右键旋转；大件物资直接追加到文字记录。
- 独立寻望物资模板和 50 条武器、物资。每次领取保存独立副本，位置和朝向随角色存档恢复。
- 修正希望骰上限、职业单项校验和孤狼名称；增加暗蚀开关与四阶段状态，压缩人物卡版面。
- PDF 输出跳过背包自动整理，保留物资摆放和旋转；普通卡牌桌面继续沿用原打印整理行为。

### 验证

- 本地 `npm run verify` 通过：1379 项 TypeScript 测试、178 项 Python 测试，以及契约、边界、类型、渲染依赖和生产构建检查。
- 真实浏览器验证资源选择、拖放、旋转、存档恢复、固定格长和 A4 页框；打印准备和结束的回归测试验证背包位置与朝向不变。
- GitHub Release 与 Deploy Release 工作流成功。公网应用版本为 0.1.27，寻望之心系统包为 1.0.3，物资选择器为单选，API 返回 ok。

## v0.1.15 — 2026-09-10 13:48:43

- 状态：已部署，公网版本与 API 健康检查通过。
- 代码 commit：[6939810](https://github.com/ZZZZzzzzac/PbDH/commit/6939810402d748c5eb4a73b377021118de864a16)。
- 上一部署：`v0.1.14` / `bdd755f`。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.15) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/34442307872) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/34442535782) · [完整差异](https://github.com/ZZZZzzzzac/PbDH/compare/v0.1.14...v0.1.15)。

### 新增

- 工作区按模板分组与多条件排序。字段按模板声明顺序决定优先级，点击循环切换不排序、升序、降序，本机记忆配置。
- 分级排序菜单仅显示有名称之外排序字段的模板，避免工具区堆叠控件。
- 玩家卡 `1.0.0` 正式模板：角色名、玩家名、生命、压力、希望、护甲槽与备注；资源以图标手动追踪，每张桌面实例独立保存状态，不自动同步人物存档。关联 #69。

### 修复

- 右键菜单按实际尺寸避让窗口边界，超高菜单可滚动，避免工作区容器裁切。
- 点击资源包名称选择根目录；右键资源包及列表空白区后，新建资源和文件夹落在根目录。
- 修复复制工作区时将根目录 `null` 误判为未选择、导致新建资源回到旧目录的问题。
- 人物卡审核修复护甲识别，补齐装备常驻属性、闪避、护甲及阈值调整，并显示“审核仅供参考”。关联 #70。
- 已选装备定义未加载时，明确提示导入对应资源包，暂停依赖装备定义的数值审核，避免旧人物存档误报。

### 调整

- Daggerheart Core 默认包从 980 条恢复为核心书 640 条，采用 `docs/third/daggerheart-core-book.pbres` 的内容；希望与恐惧 340 条作为独立包按需导入。
- 保留默认包 ID，资源包升至 `1.0.25`，系统包升至 `1.0.2`；人物数据版本与资源兼容范围不变，用户自行导入的包不被覆盖。
- 重建默认包时按核心书资源 ID 范围过滤，避免重新混入扩展。

### 验证

- 本地完整 `npm run verify` 通过：1201 项 TypeScript 测试、170 项 Python 测试，以及类型检查、契约检查、依赖检查和构建。
- GitHub Release 与 Deploy Release 工作流均成功。
- 公网核对：应用 `0.1.15`、系统包 `1.0.2`、默认资源包 `1.0.25` / 640 条，API 返回 `ok`。
- 已由用户进行本地验收；自动浏览器连接认证故障，本轮未完成自动化截图验收。

## v0.1.14 — 2026-09-10 00:29:53

- 状态：部署工作流成功，历史交接记录确认线上健康正常。
- 代码 commit：[bdd755f](https://github.com/ZZZZzzzzac/PbDH/commit/bdd755f176d50df7f7a3fd3e9b72747ff93cea56)。
- [Release](https://github.com/ZZZZzzzzac/PbDH/releases/tag/v0.1.14) · [构建记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/34376707799) · [部署记录](https://github.com/ZZZZzzzzac/PbDH/actions/runs/34377035761)。

### 修复

- dhsheet 导出声明完整的职业、种族、社群及领域名称，包含子职业与职业引用。
- 空施法值输出“不可施法”；变体卡从现有正文补齐效果，自由卡重新导入不重复添加摘要。
- 补充 JSON/dhcb 严格导入兼容回归；使用真实上游校验器验证 1004 张卡，零错误、零警告。

## 历史记录与追溯

- 更早部署记录见 [开发交接](docs/handoff.md)，本文件暂从 `v0.1.14` 开始整理。
- [GitHub Releases](https://github.com/ZZZZzzzzac/PbDH/releases) 保存版本标签和发布制品。
- [Deploy Release 历史](https://github.com/ZZZZzzzzac/PbDH/actions/workflows/deploy.yml) 保存部署执行结果；部署版本可从运行输入或下载、激活步骤核对。
- 查询 tag 对应代码：`git rev-parse 'v0.1.15^{commit}'`。
- 比较两个已部署版本：`git log --oneline v0.1.14..v0.1.15` 或查看对应 GitHub compare 页面。

后续记录同样包含版本、代码 commit、上一部署版本、成功部署时间、变更摘要与部署链接；仅发布制品但未部署成功的版本不标记为已部署。
