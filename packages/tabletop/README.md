# Tabletop

共享 Tabletop `core` 与 React Surface。宿主通过 Capability Set 注入允许命令。

## 目录约定

- `src/core/`：纯状态、命令、能力门禁与稳定诊断；禁止依赖 React、DOM、存储或 App。
- `src/react/`：共享空间画布交互层；只通过 props 接收渲染器、能力集与命令回调。
- `core` 不执行持久化；Creator 与 Player 分别拥有文档信封和 Repository。
