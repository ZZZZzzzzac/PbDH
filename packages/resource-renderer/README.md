# Resource Renderer

Canonical Card Surface 通用接口与隔离样式。接收已解析 Template，不反向读取 Template Registry。

## 结构

- `src/core.ts`：无 Registry 的 Renderer Port、精确 Revision 解析与稳定诊断；
- `src/react.tsx`：Shadow DOM Canonical Surface 边界；
- `src/RestrictedMarkdown.tsx`：Player、Creator、GM 与 Market 共用的安全 Markdown 渲染；
- 具体字段映射和 Revision 样式属于 `packages/templates/frontend`，由 App 组合根注入。

Surface 固有尺寸只读取 Resource 的正数毫米声明。宿主缩放必须作用于 Surface 外层，
不得把宿主宽度传入 Revision 触发内部 reflow。打印复用同一个 Surface。

卡牌文字支持粗体、斜体、粗斜体、有序/无序列表、换行，以及
`:red[...]`、`:orange[...]`、`:yellow[...]`、`:green[...]`、`:blue[...]`、
`:purple[...]`、`:gray[...]`。不渲染原始 HTML、外部图片或嵌套颜色指令。
