# Templates

可信 Template Registry。`core` 保持无 React；`frontend` 承载 Authoring 与前端能力。实现由 #10 子项进入。

## 目录

- `src/core/<template-id>/<exact-semver>/`：不可变 Schema 与 Core 原子能力；
- `src/core/registry.ts`：精确版本 Registry，不做近似 SemVer 回退；
- `src/frontend/<template-id>/<exact-semver>/`：纯声明 Authoring Layout；
- `src/frontend/support-manifest.ts`：按实际 Core、Authoring、Renderer 能力生成支持清单。

`core` 禁止 React、DOM、浏览器存储与 `frontend` 反向依赖。Authoring Layout 只使用
固定控件声明，不接受函数、脚本、HTML 或 CSS。
