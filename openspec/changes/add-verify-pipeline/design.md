## Context

现有脚本：`typecheck` 已先运行 `build:deepseek-harness`；`test:focused` = `test:focused:build && test:focused:run && test:tauri`，其中 focused 入口会先准备 harness 依赖。`lint` 只报警告、不报错时退出码为 0。仓库无 `.github/` 目录，远端为 GitHub。

## Goals / Non-Goals

**Goals:**
- 一条命令覆盖提交前所需的全部自动检查，失败即停。
- 远端在 Windows 上复现同一条命令。

**Non-Goals:**
- 不加入 `format`（`oxfmt --check`）：现有代码未统一格式化，加入会让检查长期失败，需另行决定。
- 不在 CI 中打包、签名或发布安装包。
- 不做真实模型生成或付费调用。

## Decisions

- **复用现有脚本拼接，而不是新写编排脚本**：`verify` = `pnpm run lint && pnpm run typecheck && pnpm run test:focused`。`&&` 天然失败即停，`test:focused` 已经包含 focused 构建、运行与 Rust 测试。备选的 Node 编排脚本只会重复这些逻辑。
- **CI 只用 `windows-latest`**：本期范围只有 Windows 桌面（AGENTS.md）。runner 自带 MSVC、Windows SDK 与 WebView2，满足 Tauri 测试宿主需要。
- **工具版本**：pnpm 由 `package.json` 的 `packageManager` 决定（`pnpm/action-setup` 自动读取）；Node 22；Rust 使用 stable MSVC，并缓存 `src-tauri/target` 以缩短时间。
- **harness 依赖**：使用 npm 官方源（锁文件已改回 `registry.npmjs.org`），CI 无需镜像。

## Risks / Trade-offs

- [CI 首跑可能暴露本机未见的环境差异，例如 Rust 版本差异] → 失败时按日志修复；在推送并实际运行前不声称 CI 通过。
- [focused 测试含真实 SDK 用例，耗时较长（本机约 8 分钟）] → 先接受；后续可按需拆分 job。
- [`concurrency` 未设置时重复推送会排队] → 工作流设置同分支取消旧运行。
