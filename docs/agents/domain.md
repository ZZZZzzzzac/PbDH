# Domain Docs

本项目采用 single-context 文档布局。

## 消费规则

开始探索代码前，读取根目录的 `CONTEXT.md`（如果存在）和 `docs/adr/` 中与当前任务相关的 ADR。文件不存在时直接继续，不需要为此预先创建。

涉及领域概念时，优先使用 `CONTEXT.md` 中的术语。若实现与现有 ADR 冲突，必须显式指出。

## 布局

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```
