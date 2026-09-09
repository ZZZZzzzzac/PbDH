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
