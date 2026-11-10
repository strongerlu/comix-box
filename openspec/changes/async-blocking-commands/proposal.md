## Why

Tauri 2 中未标注 `async` 的命令在主线程执行，执行期间窗口无法响应。仓库有 90 余个同步命令，其中读大文件、列目录、全文搜索、写入媒体字节、导入导出等在大文件或 Windows 杀毒扫描时会让界面卡住。

## What Changes

- 将 21 个重 I/O 命令改为 `#[tauri::command(async)]`，在后台线程池执行：
  - 只读：`dev_read_file`、`dev_read_many_files`、`dev_read_external_file`、`dev_hash_project_file`、`dev_list_files`、`dev_list_directory`、`dev_list_file_descendants`、`dev_list_external_files`、`dev_search_text`、`dev_search_project_paths`、`dev_get_diff`、`dev_detect_project`
  - 目标唯一的大文件写入：`dev_write_file_bytes`、`dev_copy_external`、`dev_import_project_drop`、`dev_export_project_paths`、`comfy_mcp_write_input`、`comfy_mcp_read_output`、`media_cache_file`、`erase_image_region`、`save_generated_file`
- 不改前端调用方式与命令签名。

## Capabilities

### New Capabilities
- `command-threading`: 哪些桌面命令必须离开主线程执行。

### Modified Capabilities
（无）

## Impact

- `src-tauri/src/commands/{dev,comfy_files,media,image_edit,greet}.rs` 的命令属性。
- 保持同步：普通文本写入、改名、删除、批量操作（保留主线程串行顺序）；文件对话框、剪贴板、截图、远程桥、凭据存储（依赖主线程或本身很快）。
