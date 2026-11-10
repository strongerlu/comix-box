## Why

ComfyUI 官方 MCP 的输出文件目前由 Rust `comfy_mcp_read_output` 整个读入内存、base64 编码后经 IPC 传给前端，拼成 `data:` URL；保存到项目时 `writeProjectMedia` 再把 base64 解码成字节写盘。一个 300 MB 的视频在这个过程中会同时占用约 400 MB 的 base64 字符串加数份字节副本，可能导致 WebView 卡顿或内存不足。云端 HTTP 结果已经走 `http_download_to_project` 原生流式写盘，没有这个问题。

## What Changes

- 新增 Rust 命令：把 ComfyUI 私有 `outputs/` 下的媒体文件流式复制到项目目录，复用 `read_output` 现有的 UUID 与目录约束。
- ComfyUI 视频结果不再返回 `data:` URL，改为返回输出文件的 Tauri asset 地址；任务保存分支识别该地址并调用新命令。
- 结果地址校验只额外放行 ComfyUI 私有 `outputs` 下的媒体 asset 地址（用户 2026-11-10 同意 `comfy-mcp/*/outputs/**` 进入资源访问范围；现有 `"**"` 已覆盖，不改配置）。
- `comfy_mcp_read_output` 保留给图片结果和无项目目录时的回退。

## Capabilities

### New Capabilities
- `comfy-output-persistence`: ComfyUI 输出文件从私有目录进入项目的方式与内存上限。

### Modified Capabilities
（无）

## Impact

- `src-tauri/src/commands/mcp/comfy_files.rs`、`src-tauri/capabilities`/asset 范围、`src/services/comfyMcp.ts`、`src/stores/mediaTaskStore.ts` 的结果保存分支、结果预览。
- 必须用真实 ComfyUI 视频生成在 Windows 上验收；未实测前不得声称完成。
