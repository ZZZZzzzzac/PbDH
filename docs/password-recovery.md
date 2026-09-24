# 密码恢复配置与验收

PbDH 登录窗口的「忘记密码」通过 Supabase Auth 发邮件；SMTP 凭据只配置在 Supabase，不进入仓库或 PbDH Backend。

## 回调地址

- Supabase Authentication / URL Configuration 的 Site URL 指向部署后的 PbDH 网站。
- Redirect URLs 添加 `https://daggerheart.cn/pbdh/?auth=recovery`；本地验收可添加 `http://localhost:5173/?auth=recovery` 或 `http://127.0.0.1:5173/?auth=recovery`。应用按当前 origin 和部署 base path 生成地址，不接受用户指定外站跳转。
- 保留恢复邮件模板里的 `{{ .ConfirmationURL }}`。控制台发出的默认恢复链接同样由 `PASSWORD_RECOVERY` 事件识别，不依赖特定 App 路由。
- 网站使用已有的 SPA 回退配置，加载后自动打开账号重置窗口。链接过期或已使用时显示重新申请邮件的提示。

## 手工验收

1. 使用自己控制的测试账号，在未登录时选择「忘记密码」并申请邮件；页面不显示邮箱是否注册。
2. 在另一个浏览器打开邮件链接，应直接显示「设置新密码」，不进入用户名设置或会话接管窗口；地址栏不再保留恢复 token。
3. 输入两次不同的密码应被拒绝；有效新密码提交成功后返回登录，要求重新登录。
4. 原设备下一次云端操作被拒绝；不能用旧会话直接接管，必须用新密码登录。本地人物卡、草稿及待同步内容仍在。
5. 新密码登录后 Account ID 不变，原有云端文档、媒体与回收站仍可见。
6. 再次点击已使用链接以及打开过期链接，显示可读错误；不能误用浏览器里已有的另一个账号作为恢复对象。

全局退出只撤销 Supabase 会话，尚未过期的 JWT 仍可能通过本地验签。因此认领平台会话还要访问 Supabase `/auth/v1/user` 检查会话有效性。普通云端请求无需为此逐次访问 Supabase。

相关实现测试位于 `tests/platform-auth/`、`tests/backend/test_identity.py` 和 `tests/backend/test_auth_tokens.py`，并接入根目录验证入口。
