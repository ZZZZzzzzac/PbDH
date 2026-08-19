# Player App

Player App 组合根。产品代码在 #15 及其实现 Issue 中进入；本目录当前只登记 workspace 边界。

`src/resources/route-resource-package.ts` 是首条真实 Player 路由接缝：只读取当前
System Package 的声明，不硬编码规则系统或资源类型；未命中内容完整保留到 Other Resources。
