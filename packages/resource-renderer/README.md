# Resource Renderer

Canonical Card Surface 通用接口与隔离样式。接收已解析 Template，不反向读取 Template Registry。

## 结构

- `src/core.ts`：无 Registry 的 Renderer Port、精确 Revision 解析与稳定诊断；
- `src/react.tsx`：Shadow DOM Canonical Surface 边界；
- 具体字段映射和 Revision 样式属于 `packages/templates/frontend`，由 App 组合根注入。

Surface 固有尺寸只读取 Resource 的正数毫米声明。宿主缩放必须作用于 Surface 外层，
不得把宿主宽度传入 Revision 触发内部 reflow。打印复用同一个 Surface。
