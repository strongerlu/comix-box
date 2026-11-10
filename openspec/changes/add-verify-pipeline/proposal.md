## Why

检查命令目前要逐条手工执行（typecheck、focused 构建与运行、Rust 测试），结果靠人工写进 `docs/wiki/log.md`。任何一步漏跑或环境缺失都不会被发现；仓库也没有 CI，远端提交无人自动验证。

## What Changes

- 新增 `pnpm run verify`：按「lint → typecheck（含 harness 准备）→ focused 构建 → focused 运行 → Rust 测试」顺序执行，任一步失败立即以非零退出码停止。
- 新增 GitHub Actions 工作流 `.github/workflows/verify.yml`：在 Windows runner 上对推送到 `main` 与拉取请求执行 `pnpm run verify`，工具版本与本机约定一致（pnpm 10.33.2、Node 22、Rust stable MSVC）。
- 在双机开发说明中把 `pnpm run verify` 记为提交前的统一检查入口。
- 修复两个在 Windows 上靠时机偶发失败、会让 verify 结果不可信的 Rust 测试：`http.rs` 测试服务器接受的连接继承了监听器的非阻塞模式，可能未读请求就关闭连接（10054）；`dev.rs` 条件保存测试在“版本检查通过”与“替换”之间释放读句柄，替换可能直接成功。只改测试，不改产品代码。

## Capabilities

### New Capabilities
- `verification-pipeline`: 本地一键全检入口与远端 CI 自动检查的行为约定。

### Modified Capabilities
（无）

## Impact

- `package.json` 脚本；新增 `.github/workflows/verify.yml`；`docs/wiki/开发/COMIC-BOX双机Git协作开发.md`。
- 不改变 `build:desktop`、`test:focused` 等既有脚本的行为；不涉及发布、签名与安装包。
- CI 首次运行需要推送到 GitHub 后才能验证，本地无法代为证明 CI 通过。
