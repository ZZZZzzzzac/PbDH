# System Package 创作指南

System Package 是文件优先的目录或 `.pbsys` 归档。`system.json` 是根定义，JSON Schema `contracts/system-package/1.0.0/schema.json` 是格式权威；Player 的正式加载器负责读取其余文件、内嵌 `.pbres`、脚本和页面模板。

## 从骨架开始

```text
npm run system-package -- scaffold .scratch/my-system --name "My System"
npm run system-package -- validate .scratch/my-system
npm run system-package -- schema .scratch/my-system
npm run system-package -- pack .scratch/my-system .scratch/my-system.pbsys
```

`scaffold` 会创建新的 UUIDv7 系统身份、最小页面和 Module，并内嵌一个使用“自由”Template 的资源包。它拒绝写入非空目录。`validate` 可接目录或 `.pbsys`；在命令末尾加 `machine` 可输出 JSON 诊断。`schema` 输出由当前 Modules 推导的 Character Data JSON Schema，只用于检查、AI 辅助和测试，不是可编辑源文件。`pack` 先完整验证，并拒绝覆盖已有文件。

## Character Data 版本升级

当有状态 Module 的持久数据形状发生变化时，提升 `runtime.characterDataVersion`，并在 `runtime.characterDataMigrations` 中声明完整的单链：

```json
{
  "characterDataVersion": "2.0.0",
  "characterDataMigrations": [
    {
      "fromVersion": "1.0.0",
      "toVersion": "1.1.0",
      "script": "migrations/1.0.0-1.1.0.js"
    },
    {
      "fromVersion": "1.1.0",
      "toVersion": "2.0.0",
      "script": "migrations/1.1.0-2.0.0.js"
    }
  ]
}
```

每个来源版本只能有一个下一步，每个目标版本只能有一个上一步，所有步骤必须向前，链尾必须等于当前 `characterDataVersion`。脚本以 CommonJS 函数形式导出：

```js
module.exports = ({ fromVersion, toVersion, characterData }) => ({
  ...characterData,
  newModule: characterData.oldModule,
});
```

返回值必须是只含 JSON 值的 Module 状态对象。Player 在隔离 Worker 中按顺序运行，每步检查 JSON 结果，最后按当前 System Package 的全部有状态 Module 校验。打开旧存档时只生成候选；用户确认后才一次写入。脚本异常、链缺失、校验失败、用户取消或确认前存档发生变化，原存档都保持不变。高版本存档不会被降级。

## 脚本确认

内置预置系统包由应用版本信任。上传或 Author Preview 的系统包若包含 Validation Check、Character Data Migration、Resource Format Adapter 或 Character Format Adapter 脚本，Player 会在打开人物或运行任何脚本前列出脚本并要求确认。

确认只绑定系统包 ID、系统包版本、脚本路径、用途和 SHA-256 内容摘要。同一版本的任一脚本内容变化后会再次询问；取消不会运行脚本，也不会打开、新建或改写人物存档。

脚本无法访问网络、IndexedDB、缓存、跨窗口通道或导入其他脚本，默认最长运行三秒。不要在脚本中保存密钥，也不要依赖浏览器或页面全局状态。

## 交付前检查

先运行 `npm run system-package -- validate <目录或归档>`，再运行项目统一入口 `npm run verify`。目录与归档必须得到相同的规范化结果；所有运行文件都必须由 `system.json` 声明，未声明文件会使包无效。
