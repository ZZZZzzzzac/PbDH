# 渲染性能测量

## 范围与复查

`npm run measure:renderer` 接入根目录 `npm run verify`，输出两类独立证据：

- SSR：固定敌人模板 `1.0.0`、一次预热、60 次 `renderToStaticMarkup` 的 P95。不是浏览器布局、图片解码或交互耗时。
- 生产构建：使用 Platform 实际 Vite 配置，从 entry 沿静态 imports 遍历初始 JavaScript 闭包，报告原始/gzip 字节及其中的模板渲染器、编辑器版本。独立动态 chunk 的存在不等于它没有被初始静态 imports 引入。

`fixtureMediaFileBytes` 只是单份测试图片的文件字节，不是浏览器内存。脚本不输出虚构的目录规模、卡面挂载数或堆内存数据；SSR 的有限性检查也不是性能预算。

浏览器挂载测量使用仓库规定的 Browser 插件，对真实本地页面读取 DOM。不要用 SSR、happy-dom 或源码字符串检查代替实际页面证据。也不要在浏览器测量时改动现有角色或上传测试数据。

## 2026-09-09 基线

代码基线为本地提交 `35939aa` 后的测量脚本修正，尚未实施 #66 按需加载。

环境：Windows x64，Node v24.14.1。一次执行结果：

| 项目 | 实测值 |
| --- | --- |
| 初始 JavaScript 字节 | 1,828,156 |
| 初始 JavaScript gzip 字节 | 529,815 |
| 初始闭包中的渲染器版本 | 40 |
| 初始闭包中的编辑器版本 | 40 |
| 全构建渲染器版本 | 40 |
| 单卡 SSR P95 | 4.610 ms |
| 测试图片文件字节 | 42,822 |

耗时会受机器负载影响，此结果不是跨机器硬阈值。#66 应保留历史实现，但让未引用的历史实现退出初始静态闭包；后续以该脚本和浏览器实际使用路径分别复查。

## 真实页面挂载基线

Backend 8001、Platform 5173 已通过重启脚本的模块级健康检查。Browser 插件在 `http://localhost:5173` 打开 Player 匕首之心人物卡，视口为 1265×720，使用已有本地状态，只打开资源库和搜索，不选择资源或编辑人物。

| 状态 | 领域卡目录行数 | 目录内规范卡面数 | 全页已挂载规范卡面 | 全页可见规范卡面 |
| --- | --- | --- | --- | --- |
| 打开领域卡资源库 | 210 | 0 | 1 | 0 |
| 搜索“亡者苏生” | 1 | 0 | 1 | 0 |

该表只证明这个实际工作流：目录使用表格，不按每个条目挂载卡面。全页数字包含隐藏 App Surface，不能把它解释成目录的挂载量或其他用户状态下的上界。

复查步骤：打开“选择领域卡”，用 Browser DOM 检查结果数；搜索一个条目后重复，再关闭资源库。只读采集表达式：

```js
const dialog = document.querySelector('[role="dialog"][aria-label="领域卡资源库"]');
const surfaces = [...document.querySelectorAll('[data-pbdh-canonical-surface]')];
({
  directoryRows: dialog?.querySelectorAll('tr[aria-label^="选择"]').length,
  directoryCardSurfaces: dialog?.querySelectorAll('[data-pbdh-canonical-surface]').length,
  allMountedCardSurfaces: surfaces.length,
  visibleCardSurfaces: surfaces.filter(element => element.getClientRects().length > 0).length,
});
```

当前 Browser 插件只读求值环境未暴露 Performance Timing，因此没有取得真实网络请求字节、网络时序或堆内存；不得把构建数据说成浏览器网络实测。后续模板加载验证仍需覆盖引用版本加载、重复引用复用及错误重试。

## #66 按需加载后的复查

2026-09-09，同一环境的生产构建测得：初始 JavaScript 1,448,321 字节，gzip 427,566 字节；初始静态闭包中的渲染器与编辑器版本均为 0，全构建仍保留各 40 个版本。后续微小代码修改会影响字节数；版本数与依赖闭包由统一验证重新计算。

- App 改用 `@pbdh/templates/frontend/lazy`；依赖检查阻止重新导入同步前端注册表或其私有实现路径。
- 渲染器和编辑器分开请求。同一精确版本共享在途请求及成功结果；一次重试会更新使用该版本的全部组件。
- 未显示的 App 保留控制器、账号及回收站注册，但不挂载卡面和编辑器。页面切换仍会重新调度被聚焦状态暂停的云同步。
- 封面生成在一次操作内复用各版本的加载结果，避免网络失败时按资源数量反复请求。
- 同步入口保留给契约验收和离线工具；SSR 测试先显式加载测试涉及的精确版本，再检查输出，不假装 SSR 会执行客户端加载效果。

真实 Browser 页面观察：

| 页面/操作 | 编辑器 | 规范卡面 |
| --- | --- | --- |
| Player 首次打开 | 0 | 0 |
| Creator 当前环境资源 | 环境@1.0.0 | environment-card-r2 |
| 切换到已有护甲资源 | 护甲@1.0.0 | armor-card-r1 |
| 切回 Player | 0 | 0 |

已目视检查历史护甲卡；浏览器错误日志为空。现有 GM 桌面和本地 Market 当时没有卡片/Publication，只验收了空态，未通过新增用户数据伪造场景。GM、Market、Player 的组件绑定及历史渲染器另由自动化契约/客户端测试覆盖。未取得直接网络请求跟踪，仍使用生产静态依赖图、加载器调用计数及实际渲染结果分别作证。

边界：此修改把历史渲染器和编辑器移出初始加载，不代表所有 Template Core 目录、Schema 或应用代码都已按需加载。版本清单和公共底座仍有成本；某版本可以复用旧实现作为依赖。已访问模块会留在浏览器模块缓存中，页面切换不等于卸载已下载代码。后续修改公共排版组件或字体时，仍需检查受影响的历史版本，不能仅靠冻结版本目录承诺跨环境逐像素一致。
