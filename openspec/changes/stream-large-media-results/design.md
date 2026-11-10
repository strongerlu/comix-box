## Context

- `resumeComfyWorkflow`（`src/services/comfyMcp.ts`）在 `fetch_outputs` 后调用 `io.read(file.path)`，得到 `data:` URL 作为 `MediaResult.url`。
- `mediaTaskStore.downloadAndPersistMediaAsset` 保存结果时：非 `data:` 地址走 `downloadProjectMedia` → Rust `http_download_to_project`（流式，但只接受公网 HTTP）；`data:` 地址走 `writeProjectMedia`（base64 解码后写盘）；没有项目目录时以 `data:` URL 写入应用媒体库。
- `comfy_files.rs` 的 `read_output` 已实现路径规范化、UUID 目录与 `outputs` 子目录校验和扩展名白名单。
- `tauri.conf.json` 的 asset 访问范围已含 `"**"`，ComfyUI 私有目录本来就可被 asset 协议读取；真正的前端门槛是 `isAllowedCreationResultUrl`，它目前拒绝一切 asset 地址。

## Goals / Non-Goals

**Goals:**
- 视频结果不经过 base64；有项目目录时内存占用与文件大小解耦。
- 复用现有路径校验，前端只放行 ComfyUI 私有 `outputs` 下的媒体 asset 地址。

**Non-Goals:**
- 不改云端 HTTP 结果链路（已经流式）。
- 不改图片结果（体积小，继续用 `data:` URL）。
- 不收紧 asset 访问范围里既有的 `"**"`（影响面大，另立变更）。
- 不处理 Web 端（本期仅 Windows 桌面）。

## Decisions

- **结果引用格式**：视频结果的 `url` 改为输出文件的 Tauri asset 地址（`convertFileSrc(path)`）。`<video>` 可直接播放，所有显示位置无需改动；任务记录的 `assetUri` 已存绝对路径，引用里含本机路径不新增暴露面。否决的备选：自定义 `comfy-output://` 引用，需要改所有显示与校验位置。
- **前端放行**：`isComfyOutputAssetUrl` 只认解码后路径形如 `…/comfy-mcp/<UUID>/outputs/<文件>.(mp4|webm|mov|png|jpg|jpeg|webp)` 的 asset 地址；`isAllowedCreationResultUrl` 放行它，其他 asset 地址仍被拒绝。最终校验由 Rust 完成。
- **复制命令**：`comfy_mcp_copy_output_to_project(path, root, relativePath)`，异步执行、在阻塞线程池里复制：先走与 `read_output` 相同的校验，项目路径用 `dev::resolve_write_path`，目标已存在时拒绝覆盖；`std::io::copy` 写入带 UUID 的 `.part` 临时文件后重命名，失败时只清理自己的临时文件。
- **无项目目录**：仍用 `comfy_mcp_read_output` 读出 base64 后走原有应用媒体库路径，因此保留该命令（图片结果也继续使用它）。
- **asset 范围**：用户已同意加入 `comfy-mcp/*/outputs/**`；由于现有 `"**"` 已覆盖，不改配置文件。

## Risks / Trade-offs

- [私有输出文件被清理后旧任务无法预览] → 保存到项目后以项目文件为准；未保存的任务预览失败时可重新查询原任务。
- [无项目目录时仍有 base64] → 与修改前一致，不在本变更解决。
- [自动化测试无法覆盖真实生成] → Rust 单测覆盖校验与复制，前端测试覆盖分支选择；必须做一次真实 Windows 生成验收。
