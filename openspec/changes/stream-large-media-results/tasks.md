## 1. Rust

- [x] 1.1 先写单测：越界路径、非媒体扩展名、项目外目标、已存在目标被拒绝；合法视频复制后内容一致、不留临时文件
- [x] 1.2 抽出 `read_output` 的路径校验，实现异步 `comfy_mcp_copy_output_to_project`，注册命令与权限
- [x] 1.3 asset 访问范围：确认现有 `"**"` 已覆盖 `comfy-mcp/*/outputs/**`，不改配置

## 2. 前端

- [x] 2.1 先写测试：`isComfyOutputAssetUrl` 只认私有 outputs 媒体；ComfyUI 视频结果返回 asset 地址且不调用 base64 读取；保存分支调用复制命令而非 `writeProjectMedia`
- [x] 2.2 `resumeComfyWorkflow` 视频结果改为返回 asset 地址；`isAllowedCreationResultUrl` 放行该类地址
- [x] 2.3 `mediaTaskStore` 保存分支识别该地址：有项目目录调用复制命令，无项目目录经 `comfy_mcp_read_output` 走原路径

## 3. 验收

- [x] 3.1 `pnpm run verify` 通过（focused 2388 项 2377 通过 0 失败 11 跳过；Rust 513 通过 0 失败）
- [ ] 3.2 Windows 真实 ComfyUI 生成一个视频：任务完成、预览可播放、保存到项目成功、文件哈希与输出一致
