# PbDH

围绕 Powered by Daggerheart 生态构建的桌游工具 monorepo。

## 环境

- Node.js 22+
- npm 11+
- Python 3.10+

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

## 部署

生产服务器沿用现有 Nginx 与不可变 GitHub Release：前端同时构建
`/pbdh_tools/` 预览版和 `/pbdh/` 主入口版，单实例 FastAPI Backend
沿用 systemd 且仅绑定宿主回环地址。配置、备份、发布和一键切换步骤见
[deploy/README.md](deploy/README.md)。

## 目录

- `apps/`：Player、Creator、Market 与 Platform Backend 组合根。
- `contracts/`：语言无关 Contract Schemas 与跨语言 fixtures。
- `packages/`：Contract Runtime、Template、Renderer、Conversion 与 Tabletop 共享能力。
- `tests/`：跨 App、Contract 和架构边界测试。
- `scripts/`：非交互式开发与验证脚本。
- `docs/`：路线图、领域文档与 ADR。
