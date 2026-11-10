## Context

`pnpm run lint`（oxlint）报告 `no-unused-vars`。AGENTS.md 要求只删除「确认无调用者、且不属于记忆工作台能力闭包」的内容，桌面功能只增不减。

## Goals / Non-Goals

**Goals:**
- 删除明确无用、无功能含义的私有辅助函数与常量。

**Non-Goals:**
- 不删除看起来属于功能入口的未使用函数，例如 `skillsManageStore.ts` 的 `loadObsidianVaults`、`importDiscoveredSkillToCentral` 等，以及 `agentStore.ts` 的 `toggleJevScorerAutostart`。它们可能是尚未接线的桌面功能，删除前需用户确认。
- 不改 `src/utils/tts.ts` 的 `currentUtterance`：保留语音对象引用可防止浏览器在播放中回收它，属于有意写法。
- 不清理未使用的 import 与 catch 参数：收益小，且删除模块唯一导入可能改变副作用加载顺序，需逐个核对。

## Decisions

- **判定依据**：全仓库（排除 `node_modules`、`target`、`docs`）文本搜索名字，只在定义处出现；且未 `export`。源码契约测试（用正则读源码的测试）也不引用这些名字。
- **保留 `dataUrlToBlob`**：删除 `toBlob` 后它仍被 `readImageReference` 使用。

## Risks / Trade-offs

- [动态访问（字符串拼名）未被搜索覆盖] → 这些都是模块内 `function`/`const`，没有对象表注册，无法被动态访问。
