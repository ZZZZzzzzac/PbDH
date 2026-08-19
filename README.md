# PbDH

围绕 Powered by Daggerheart 生态构建的桌游工具 monorepo。

## 环境

- Node.js 22+
- npm 11+
- Python 3.12+

Python 依赖必须安装到项目虚拟环境，不安装到全局环境：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
npm install
```

## 验证

```powershell
npm run verify
```

该命令统一执行依赖边界、TypeScript/Python Contract conformance、测试与类型检查。

## 目录

- `apps/`：Player、Creator、Market 与 Platform Backend 组合根。
- `contracts/`：语言无关 Contract Schemas 与跨语言 fixtures。
- `packages/`：Contract Runtime、Template、Renderer、Conversion 与 Tabletop 共享能力。
- `tests/`：跨 App、Contract 和架构边界测试。
- `scripts/`：非交互式开发与验证脚本。
- `docs/`：路线图、领域文档与 ADR。
