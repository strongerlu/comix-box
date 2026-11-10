## Context

- asset 范围：`**`、`$HOME/**`、`$APPDATA/output/**`、`$APPDATA/data/media/**`、`$RESOURCE/storyboarder/**`。
- `convertFileSrc` 的使用者：项目媒体（项目可位于任意盘符）、媒体库真实路径、缩略图、本地内容工具输出、ComfyUI 私有输出、Storyboarder 资源。旧任务还可能引用其他项目目录里的媒体。
- `dev_read_file` 等文件命令接受调用方提供的任意 `root`，并不校验它是否为已打开的项目。
- CSP：`script-src 'self' http://tauri.localhost https://tauri.localhost`，没有 `unsafe-inline` 或 `unsafe-eval`；`v-html` 的 4 处渲染经 DOMPurify 处理。

## Decisions

- **不收紧 asset 范围。** 能利用 asset 地址读文件的前提是 WebView 里执行了攻击者脚本；而一旦能执行脚本，就能直接调用接受任意 `root` 的文件命令读写任意文件。只收紧 asset 范围并不能堵住这条路，却会让位于其他盘符的项目和旧任务的媒体无法预览。
- **锁住 CSP。** 注入的 HTML 或 Markdown 无法执行脚本，是唯一同时挡住 IPC 与 asset 两条路径的边界。用配置测试防止以后有人为了方便加入 `unsafe-inline`、`unsafe-eval` 或外部脚本源。
- **真正的收紧方案（未实施，需单独立项）：** 所有文件命令只接受经用户选择登记过的项目根，asset 范围随之按登记的根动态放行。这会改动全部 `dev_*` 命令和项目打开流程。

## Risks / Trade-offs

- [`"**"` 仍然存在] → 只要 CSP 测试保持通过，就不构成独立的攻击面。若将来允许加载远程脚本或插件页面，必须先实施上面的登记方案。
