## 1. 本地入口

- [x] 1.1 在 `package.json` 新增 `verify` 脚本：`pnpm run lint && pnpm run typecheck && pnpm run test:focused`
- [x] 1.2 本机执行 `pnpm run verify`，记录各步骤结果（2026-11-09：lint、typecheck 通过；focused 2385 项 2374 通过 0 失败 11 跳过；Rust 512 通过 0 失败 2 忽略）

## 2. 远端 CI

- [x] 2.1 新增 `.github/workflows/verify.yml`（windows-latest、pnpm/action-setup、Node 22、Rust stable、target 缓存、同分支并发取消）
- [ ] 2.2 用 `openspec validate` 校验本变更；CI 实际运行结果待推送后确认

## 3. 文档

- [x] 3.1 在 `docs/wiki/开发/COMIC-BOX双机Git协作开发.md` 的检查命令处说明 `pnpm run verify`

## 4. 稳定偶发失败的 Rust 测试

- [x] 4.1 `http.rs` 下载重试测试：接受连接后 `set_nonblocking(false)`（与 `media_download.rs` 测试一致）；单测连续 10 次通过
- [x] 4.2 `dev.rs` 条件保存测试：写入外部改动后持有读句柄直到写入方返回；修复前单测 20 次失败 1 次，修复后 40 次全通过
