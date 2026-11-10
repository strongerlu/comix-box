## ADDED Requirements

### Requirement: 本地一键全检
系统 SHALL 提供 `pnpm run verify`，依次执行 lint、typecheck、focused 构建、focused 运行与 Rust 测试，并在任一步失败时立即以非零退出码结束，不再执行后续步骤。

#### Scenario: 全部检查通过
- **WHEN** 开发者在依赖齐全的 Windows 工作区执行 `pnpm run verify`
- **THEN** 五个步骤依次执行且全部成功，命令以退出码 0 结束

#### Scenario: 中途失败立即停止
- **WHEN** typecheck 报告类型错误
- **THEN** 命令以非零退出码结束，且不执行 focused 构建、focused 运行与 Rust 测试

### Requirement: 远端自动检查
仓库 SHALL 在推送到 `main` 和创建或更新拉取请求时，于 Windows runner 上安装锁定依赖并执行 `pnpm run verify`。

#### Scenario: 推送触发检查
- **WHEN** 有提交推送到 `main`
- **THEN** GitHub Actions 在 `windows-latest` 上使用 `pnpm install --frozen-lockfile` 安装依赖并运行 `pnpm run verify`，任一步失败则该检查标记为失败

#### Scenario: 锁文件不一致
- **WHEN** `package.json` 与 `pnpm-lock.yaml` 不一致
- **THEN** 安装步骤失败，检查不会在未锁定的依赖上继续运行
