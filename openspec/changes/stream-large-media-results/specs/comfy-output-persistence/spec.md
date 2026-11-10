## ADDED Requirements

### Requirement: ComfyUI 视频结果流式进入项目
系统 SHALL 在有项目目录时把 ComfyUI 输出的视频文件从应用私有目录直接复制到项目目录，SHALL NOT 在前端以 base64 或 `data:` URL 形式持有完整视频内容。

#### Scenario: 大视频保存到项目
- **WHEN** ComfyUI 任务完成，输出 MP4，且当前有项目目录
- **THEN** 结果地址是该输出文件的 asset 地址，文件由原生命令复制到项目媒体目录，任务记录引用项目路径，且不调用 base64 读取

#### Scenario: 输出路径越界
- **WHEN** 待复制的路径不在私有工作目录的 `<UUID>/outputs/` 下，或扩展名不是允许的媒体类型
- **THEN** 复制被拒绝，项目目录中不留下任何文件

#### Scenario: 目标已存在
- **WHEN** 项目中的目标路径已有文件
- **THEN** 复制被拒绝，原文件内容不变

### Requirement: 只放行 ComfyUI 私有输出的本地地址
创作结果地址校验 SHALL 只接受指向 ComfyUI 私有工作目录 `<UUID>/outputs/` 内媒体文件的 asset 地址，其他 asset 地址 SHALL 继续被拒绝。

#### Scenario: 预览私有输出
- **WHEN** 结果地址是 `comfy-mcp/<UUID>/outputs/result.mp4` 的 asset 地址
- **THEN** 地址校验通过，可在任务记录中直接播放

#### Scenario: 其他本地文件
- **WHEN** 结果地址是指向其他目录（例如用户主目录）的 asset 地址，或 `outputs` 下的非媒体文件
- **THEN** 地址校验不通过
