# 服务器部署

## 当前目标：搬瓦工正式部署

从 v0.1.10 起，`Deploy Release` 使用独立 GitHub Environment
`bandwagon-preview`，部署到 `192.243.116.94`（AlmaLinux 9.7 x86_64）。
Release 使用 Python 3.11 的 Linux 二进制依赖，新机通过
`/usr/bin/python3.11` 运行；切换前会实际导入二进制依赖检查兼容性。
Python 3.10 的旧制品不能直接作为新机回滚版本。

- `DEPLOY_HOST=192.243.116.94`，`DEPLOY_USER=root`。
- `DEPLOY_PATH=/var/www/pbdh-platform`。
- `PUBLIC_URL=https://daggerheart.cn/pbdh/`。
- SSH key 与 known hosts 只存该 Environment 的 Secrets。
- `deploy/bandwagon-preview.conf` 管理 IP HTTP 测试入口，保留既有 SRD 路径。
- 新机数据位于 `/var/lib/pbdh-platform`，已完成旧站停写后的最终一致性同步；正式账号配置已恢复。
- `deploy/bandwagon-preview-tls.conf` 提供临时 HTTPS 与 API 入口，支持 WebCrypto；不要用 HTTP IP 地址验收玩家车卡器。
- Let's Encrypt 证书通过 webroot 签发；`pbdh-preview-cert-renew.timer` 每日两次检查续期，续期后重载 Nginx。
- 公网 HTTP 仅供连通性测试，API 除 health 外为 403；完整功能测试使用上述 HTTPS 地址。
- 正式域名已切到新机。`Inspect public routes` 只读检查新机服务，不再修改旧机路由。
- 正式域名 Nginx 配置在 `Daggerheart_VPS/bandwagon/daggerheart-production.conf`；系统包目录必须优先匹配，允许公开的 `.pbdh-runtime-files.json`。
- 正式认证已恢复，但本轮未进行真实账号登录验收。

旧站应用已停用，旧 Nginx 仅转发新机；禁止直接恢复旧应用造成数据分叉。最终私有归档位于 `/srv/domain-migration-20260909/final/`，回滚前必须先备份并同步新机写入。新机的早期
`pbdh-preview` 服务及 `/srv/bandwagon-preview/pbdh` 保留供回退，部署新版时
停止旧预览服务，避免争用 8001。正式服务为 `pbdh-platform`。

本机可用 SSH 私钥路径为
`D:/Game/Daggerheart/Daggerheart_VPS/.ssh/ssh-key-2026-03-20.key`，
不要提交私钥。网络节点可能影响 SSH 连接；认证前断连不代表公钥错误。

## 旧服务器部署记录（仅历史参考，不再执行以下切流步骤）

生产部署沿用 `Daggerheart_VPS` 的 Nginx、Let's Encrypt 和不可变 GitHub
Release 目录。前端由宿主 Nginx 直接提供；FastAPI 沿用 systemd 管理，
只监听 `127.0.0.1:8001`。SQLite/WAL 位于宿主
`/var/lib/pbdh-platform`，因此部署目录和容器都不是数据的唯一副本。

## 公开地址（0.1.9 主入口切换后）

- `/pbdh/`：综合应用，默认打开 Player 与匕首心系统包。
- `/pbdh_tools/`：旧 `PbDH_Sheet 2.3.0` 的独立部署副本。
- `/api/`：反向代理到新 Platform Backend；旧站不使用这个路径。

每个 Release 仍构建两个基路径版本。首次切换通过 `Manage public routes`
工作流的 `new` 模式完成：复制旧站到 `/var/www/pbdh-legacy-tools`，只调整
部署副本中的资源基路径，保留原 Release；保存 Nginx 配置后一次重载切换
两个入口。配置检查或重载失败自动恢复。`rollback` 模式恢复切换前的两个
入口，备份位于 `/var/www/pbdh-route/promotion-backup`。切换不移动数据库。
旧 `switch-pbdh-route` 只管单入口，双入口切换后不再用它回退。

## 首次安装

1. 使用服务器已有的 Ubuntu 22.04 / Python 3.10；无需安装 Docker、pip 包或
   virtualenv。生产 Python 包随 Release 一起上传。
2. 将 `deploy/.env.example` 复制到 `/etc/pbdh-platform.env`，权限设为
   `root:root 0600`，填入 Supabase 与管理员配置。
3. 发布脚本会创建无登录权限的 `pbdh-platform` 系统用户、数据目录和
   systemd unit。
4. 从 `Daggerheart_VPS/daggerheart_tools/` 安装 Nginx 配置和
   `switch-pbdh-route`，先执行一次 `switch-pbdh-route legacy`。
5. 在 GitHub `production-preview` Environment 配置：
   `DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_PATH=/var/www/pbdh-platform`、
   `PUBLIC_URL=https://daggerheart.cn/pbdh/`，以及
   `DEPLOY_SSH_KEY`、`DEPLOY_KNOWN_HOSTS`。

部署账号需要能够无交互执行发布脚本中的有限 `sudo` 操作。不要把
`/etc/pbdh-platform.env` 或任何密钥提交到仓库。

## 发布与部署

推送 `vX.Y.Z` tag 后，`release.yml` 会运行完整 `npm run verify`，
构建双基路径前端，并发布带 SHA-256 的不可变压缩包。随后手动运行
`Deploy Release` workflow，输入不带 `v` 的版本号。

部署工作流会校验 Release 摘要、上传到版本化 staging 目录、备份 SQLite、
使用 Release 内置的 `python-packages` 启动单 worker Backend、等待健康
检查通过，再原子切换
`/var/www/pbdh-platform/current`。主入口切换后它更新 `/pbdh/`，不会改动
旧 Sheet 副本。工作流通过 Environment 的 `PUBLIC_URL` 核对部署版本。

## 验证与回滚

```bash
curl --fail https://daggerheart.cn/pbdh/
curl --fail https://daggerheart.cn/pbdh_tools/
curl --fail https://daggerheart.cn/api/health
sudo systemctl status pbdh-platform --no-pager
```

重新部署旧 Release 即可回滚应用版本。双入口切换错误时执行：

```bash
gh workflow run routes.yml -f mode=rollback
```

Backend 日志使用 `journalctl -u pbdh-platform` 查看。数据库备份位于
`/var/lib/pbdh-platform/backups`；还必须定期同步到服务器
外。SQLite 当前只支持单 Backend 实例，不得把 worker 数量调高。不要删除
`/var/lib/pbdh-platform`，也不要在没有匹配备份的情况下回退数据库 schema。
