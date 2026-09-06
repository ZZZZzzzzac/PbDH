# 服务器部署

生产部署沿用 `Daggerheart_VPS` 的 Nginx、Let's Encrypt 和不可变 GitHub
Release 目录。前端由宿主 Nginx 直接提供；FastAPI 沿用 systemd 管理，
只监听 `127.0.0.1:8001`。SQLite/WAL 位于宿主
`/var/lib/pbdh-platform`，因此部署目录和容器都不是数据的唯一副本。

## 双轨地址

- `/pbdh/`：默认仍指向旧 `PbDH_Sheet`。
- `/pbdh_tools/`：始终指向本仓库最新部署的 Release。
- `/api/`：反向代理到新 Platform Backend；旧站不使用这个路径。

每个 Release 同时构建 `/pbdh_tools/` 和 `/pbdh/` 两份前端。稳定后在
服务器执行 `sudo /usr/local/sbin/switch-pbdh-route new`，即可原子地把
`/pbdh/` 切到本仓库；执行 `... legacy` 可立即切回旧站。切换不重建
前端、不移动数据库。

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
   `PUBLIC_URL=https://daggerheart.cn/pbdh_tools/`，以及
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
`/var/www/pbdh-platform/current`。它只更新 `/pbdh_tools/`，不会自动
替换 `/pbdh/`。

## 验证与回滚

```bash
curl --fail https://daggerheart.cn/pbdh_tools/
curl --fail https://daggerheart.cn/api/health
sudo systemctl status pbdh-platform --no-pager
```

重新部署旧 Release 即可回滚应用版本。主入口切换错误时执行：

```bash
sudo /usr/local/sbin/switch-pbdh-route legacy
```

Backend 日志使用 `journalctl -u pbdh-platform` 查看。数据库备份位于
`/var/lib/pbdh-platform/backups`；还必须定期同步到服务器
外。SQLite 当前只支持单 Backend 实例，不得把 worker 数量调高。不要删除
`/var/lib/pbdh-platform`，也不要在没有匹配备份的情况下回退数据库 schema。
