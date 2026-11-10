# code-hygiene Specification

## Purpose
约束只删除确认无调用者的私有代码，不借清理之名削减桌面能力。
## Requirements
### Requirement: 创作链路不保留无调用者的私有辅助代码
创作运行时、任务存储与媒体 API 模块（`creationMediaRuntime.ts`、`mediaTaskStore.ts`、`media-generation.ts`、`creationModelRegistry.ts`、`mediaModelCapabilities.ts`）SHALL NOT 包含未导出且没有调用者的函数或常量。

#### Scenario: lint 检查
- **WHEN** 执行 `pnpm run lint`
- **THEN** 上述模块不出现「declared but never used」类的函数或常量警告

#### Scenario: 删除不改变行为
- **WHEN** 删除这些私有定义后执行 typecheck 与 focused 测试
- **THEN** 全部通过，导出接口不变

