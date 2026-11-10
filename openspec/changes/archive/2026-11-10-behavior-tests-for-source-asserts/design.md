## Context

源码断言分布（替换前）：`creationPanelContractUi.test.ts` 80、`deepSeekHarness.test.ts` 38、`desktopRemoteBridge.test.ts` 13、`manjuProduction` 7、`skillSourcesContract` 7、`creationMediaRuntime` 5，其余分散。

## Decisions

- **用运行时替身而不是读源码**：设置 `window.__TAURI_INTERNALS__.invoke` 记录命令调用，用 `fetch` 替身记录云端请求；每个用例结束恢复全局并调用 `__resetApiKeyMemoryCacheForTests`。
- **断言路由结果而不是写法**：桌面成功只调用 `document_to_markdown_file`；`internal` 错误回退云端；`unsupported_format` 不回退；`invoke` 抛错回退云端。
- **保留合理的源码断言**：校验配置文件、权限清单、打包产物等静态合同的断言不属于本变更替换范围。

## Risks / Trade-offs

- [替身与真实 Tauri 行为不一致] → 替身只模拟 `invoke` 返回值，Rust 侧转换由 Rust 测试覆盖。
