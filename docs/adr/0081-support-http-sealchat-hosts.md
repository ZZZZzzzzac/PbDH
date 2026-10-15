# HTTP SealChat 宿主兼容

状态：已接受。补充 ADR 0080 的 SDK 加载边界，其余会话授权与数据所有权保持不变。

## 问题

玩家自建 SealChat 常通过 HTTP 公网 IP 与端口访问。HTTPS PbDH iframe 不能加载该宿主的 HTTP SDK；HTTP 祖先还会使 iframe 失去安全上下文，`crypto.subtle` 和 `crypto.randomUUID` 不再可用，导致系统包摘要、人物创建与保存失败。仅移除 HTTPS 地址校验无法完成接入。

## 决策

HTTPS 与回环宿主继续加载其提供的官方 SDK。普通 HTTP 宿主改从本站已有的 `https://daggerheart.cn/chat/api/v1/channel-embed-sdk.js` 加载官方 v1 客户端；不复制 SDK、不新增代理、不修改或重编译 SealChat/Dice。这个地址只提供脚本，人物、身份、权限与指令通过浏览器 MessageChannel 直接和原 HTTP 宿主通信。

仍校验宿主注入的 `hostOrigin` 为完整 HTTP(S) origin，原 `sdkUrl` 与宿主同源、无凭据和查询参数、路径以官方 SDK 路径结尾。只在校验后选择固定 HTTPS SDK；握手继续指定原宿主的准确 origin，官方客户端校验父窗口、nonce 和协议版本。不同宿主版本不兼容时按原握手/权限错误显示，不绕过权限。

新增无 React、DOM 或业务依赖的 `@pbdh/crypto-runtime`。摘要优先使用原生 WebCrypto，缺失时使用锁定版本的 `@noble/hashes` SHA-256；UUID 优先使用原生实现，缺失时使用 `crypto.getRandomValues` 构造 UUID v4。禁止用 `Math.random` 生成持久化身份。摘要输入复制、字节视图范围、输出和所有 Contract fixtures 保持一致，不修改全局 crypto 或安全上下文。

Player、共享 Contract/媒体/云文档及同一 Platform 内可切换的 Creator/GM 调用此底座。系统包 Worker 在缺少原生能力时通过执行上下文参数提供其既有 SHA-256 接口，不改已发布系统包脚本，不增添网络、数据库或全局权限。

连接配置错误优先展示；未加载系统包显示“等待人物卡”，只有实际加载了其他系统包才显示“不支持”。

## 验证与限制

回归覆盖 HTTP origin/SDK 校验、原生与回退摘要一致、UUID、人物新建/本地保存重读、Worker 脚本摘要及状态文案；接入根 `npm run verify`。浏览器通过非回环 HTTP 入口验证原生 WebCrypto 缺失时的真实人物卡与官方 SDK 握手。隔离宿主只用合成数据，不能替代对方实际 SealChat/Dice 的上线复验。

HTTP 兼容不把原聊天站升级为加密传输。普通 HTTP 宿主依赖本站官方 HTTPS SDK 的可用性及 v1 协议兼容；本站 SDK 服务不可用时连接失败，人物本地功能仍可用。无需用户更换嵌入代码、购买域名或关闭浏览器保护。
