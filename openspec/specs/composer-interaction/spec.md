# composer-interaction Specification

## Purpose
TBD - created by archiving change split-component-state-boundaries. Update Purpose after archive.
## Requirements
### Requirement: 输入框菜单互斥与定位
权限、Skill、漫剧菜单 SHALL 同时最多打开一个；再次点击已打开菜单的按钮 SHALL 关闭它。菜单 SHALL 贴按钮上方定位并保持在窗口内至少 12 像素。

#### Scenario: 切换菜单
- **WHEN** 权限菜单已打开，用户点开 Skill 菜单
- **THEN** 权限菜单关闭，Skill 菜单打开并获得焦点

#### Scenario: 靠右的按钮
- **WHEN** 按钮靠近窗口右边缘
- **THEN** 菜单左边缘不超过窗口宽度减 332 像素

### Requirement: 菜单键盘导航
打开的菜单 SHALL 支持上下方向键循环移动焦点，Escape SHALL 关闭菜单并把焦点还给输入框。

#### Scenario: Escape
- **WHEN** 菜单打开时按 Escape
- **THEN** 菜单关闭，输入框重新获得焦点

### Requirement: @ 提及候选
@ 提及候选 SHALL 按范围加载：Skill 范围只列 Skill；MCP 工具按服务前缀合并为一项；文件候选 SHALL 跳过文件夹、对话记录和非 Office 二进制文件，且每次最多搜索 40 条。

#### Scenario: 点 @Skill
- **WHEN** 范围为 Skill
- **THEN** 候选全部是 Skill，不加载文件或对话

#### Scenario: 文件候选过滤
- **WHEN** 搜索结果含文件夹、对话记录和不可读二进制
- **THEN** 这些条目不出现在候选中

