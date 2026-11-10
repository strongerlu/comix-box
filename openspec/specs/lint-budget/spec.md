# lint-budget Specification

## Purpose
TBD - created by archiving change lint-warning-budget. Update Purpose after archive.
## Requirements
### Requirement: lint 警告数不得增加
`pnpm run lint` SHALL 在警告数超过 `package.json` 中记录的上限时以非零退出码失败，从而使 `pnpm run verify` 与 CI 失败。

#### Scenario: 新增一条警告
- **WHEN** 改动引入一条新的 lint 警告，使总数超过上限
- **THEN** `pnpm run lint` 失败并列出警告

#### Scenario: 警告数不变或减少
- **WHEN** 警告总数小于或等于上限
- **THEN** `pnpm run lint` 以零退出码通过

### Requirement: 自动修复不得改变语义
lint 自动修复 SHALL 只保留与原代码语义等价的改写；无法确认等价的改写 SHALL 恢复或改为等价写法。

#### Scenario: 类型化数组比较
- **WHEN** 自动修复把 `[...bytes.slice(0, 2)]` 改成直接比较 `Uint8Array`
- **THEN** 改为 `Array.from(bytes.slice(0, 2))`，断言结果与修复前一致

