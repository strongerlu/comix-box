# project-tree-view Specification

## Purpose
TBD - created by archiving change split-large-components-round2. Update Purpose after archive.
## Requirements
### Requirement: 建树与加载顺序
文件树 SHALL 把扁平条目挂到各自父目录下，每层目录在前、目录按修改时间倒序、文件按路径排序。

#### Scenario: 加载项目根目录
- **WHEN** 根目录下有两个文件夹（修改时间不同）和两个文件
- **THEN** 新修改的文件夹在最前，文件按名字排在文件夹之后

### Requirement: 筛选保留命中项的上级目录
筛选 SHALL 支持拼音模糊匹配，并保留命中项的所有上级目录；搜索结果树 SHALL 补齐缺失的上级目录。

#### Scenario: 拼音筛选
- **WHEN** 输入 `juese`，展开的文件夹「场景」里有「角色设计稿.png」
- **THEN** 结果包含「场景」、该文件与文件夹「角色设计」

### Requirement: 显示排序不改动已加载的树
展开视图 SHALL 按用户选择的排序模式排列同级节点，目录始终在前，且不改变已加载树的子节点顺序。

#### Scenario: 切换为名称倒序
- **WHEN** 排序模式为名称倒序
- **THEN** 显示顺序为目录、`b.md`、`a.md`，已加载树的顺序不变

### Requirement: 资源剪贴板跟随文件变化
资源剪贴板 SHALL 在空选区时不生成；当剪贴板中的资源或其上级被删除时 SHALL 清空；资源被改名时 SHALL 更新路径和名字；其他项目的变更 SHALL NOT 影响剪贴板。

#### Scenario: 剪切后改名
- **WHEN** 已剪切的文件在粘贴前被改名
- **THEN** 粘贴使用新路径

#### Scenario: 上级目录被删
- **WHEN** 剪贴板中资源的上级目录被删除
- **THEN** 剪贴板清空

### Requirement: 媒体排序编号先预演后改名
打开媒体排序编号 SHALL 只生成预演计划、不改任何文件，编号基础名取当前文件夹名；确认后 SHALL 逐个改名，成功提示走成功通道，中途失败 SHALL 在错误通道说明已完成数量。预演期间切换项目 SHALL 丢弃预演。

#### Scenario: 无需编号
- **WHEN** 文件夹里没有需要改名的媒体
- **THEN** 不打开预演弹窗，并说明原因

#### Scenario: 中途失败
- **WHEN** 第二个文件改名失败
- **THEN** 错误提示说明已编号 1 个，随后失败

### Requirement: 右键菜单编号入口按媒体数显示
目录右键菜单 SHALL 在统计完成前或媒体文件多于 1 个时显示编号入口；统计结果 SHALL 只在菜单仍指向该目录时生效。

#### Scenario: 菜单已切换目标
- **WHEN** 统计返回前右键菜单已指向别的目录
- **THEN** 统计结果被丢弃

