## Why

`tauri.conf.json` 的 asset 访问范围含 `"**"`，WebView 可以通过 asset 地址读取本机任意文件。原计划收紧为应用目录加运行时放行的项目目录，作为纵深防御。

## What Changes

- 评估后**不收紧 asset 范围**，改为用测试锁住真正阻止注入内容读取本机文件的防线：CSP 只允许运行应用自带脚本。
- 新增测试：`script-src` 与 `default-src` 不得出现 `'unsafe-inline'`、`'unsafe-eval'`、`'wasm-unsafe-eval'`、通配符、`data:`/`blob:` 或外部主机；`object-src` 如存在也不得放开。

## Capabilities

### New Capabilities
- `webview-script-boundary`: WebView 只执行应用自带脚本的约定。

### Modified Capabilities
（无）

## Impact

- `src/utils/__tests__/urlSafety.test.ts` 新增一项配置测试；不改配置与运行时代码。
