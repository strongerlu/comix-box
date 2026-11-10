## ADDED Requirements

### Requirement: WebView 只执行应用自带脚本
桌面 CSP 的 `script-src` 与 `default-src` SHALL 只允许应用自身来源，SHALL NOT 包含 `'unsafe-inline'`、`'unsafe-eval'`、`'wasm-unsafe-eval'`、通配符、`data:`、`blob:` 或任何外部主机。

#### Scenario: 有人为了方便放开内联脚本
- **WHEN** `tauri.conf.json` 的 `script-src` 加入 `'unsafe-inline'`
- **THEN** focused 测试失败，`pnpm run verify` 不通过

#### Scenario: 注入的 Markdown 含脚本
- **WHEN** 渲染的 AI 内容或 Skill 文档中包含 `<script>` 或事件处理属性
- **THEN** 浏览器按 CSP 拒绝执行，内容无法调用 IPC 或读取 asset 文件
