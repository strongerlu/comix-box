# COMIC-BOX 独立 Windows 对比版本

2026-10-27 用户确认：COMIC-BOX 作为独立软件，与韭菜盒子安装在不同目录并同时启动。本期仅实施 Windows。

## 应用与本地状态隔离

| 项目 | COMIC-BOX |
| --- | --- |
| 显示名称／开始菜单目录 | COMIC-BOX |
| Windows 主程序 | `comic-box.exe` |
| Bundle identifier／单实例互斥标识 | `com.comicbox.desktop` |
| Tauri 应用数据与 WebView 配置 | 使用新 identifier 对应的独立目录 |
| Windows 凭据服务 | `com.comicbox.app` |
| CLI Key、会话、插件、MCP 发现与工具目录 | `~/.comic-box/` |
| 中央 Skill 与旧 Skill 设置兼容目录 | `~/.comic-box/skills`、`~/.comic-box/skillsmanage` |
| 回调协议 | `comic-box://` |

不迁移、覆盖或删除原版凭据及应用数据；原版仍使用自己的安装目录、identifier、配置和回调。数据库兼容导入仅从 COMIC-BOX 自己的旧格式目录读取，不导入 `~/.jiucaihezi/data`。

项目文档仍按用户所选目录读写，安装目录和应用数据隔离不等于复制项目文件。模型服务和云端账号接口继续沿用现有服务；不同软件的本地登录状态分别保存。

## Windows 对比包

```powershell
corepack pnpm exec tauri build --debug --bundles nsis --config src-tauri/tauri.windows-comparison.conf.json
```

这是未优化的本地调试对比包，包含前端和原生运行时，不需要 Vite。开发模式用 `tauri::is_dev()` 判断，只有 `tauri dev` 加载开发服务器并跳过互斥；独立安装包即使启用 debug assertions 也使用内置页面与新 identifier 的单实例锁。对比包覆盖配置使用 zlib 加快本地安装包压缩，正式构建的既有压缩配置保留。

首次登录时会创建新的私有会话目录。Windows 发布烟测、便携版复制和指纹脚本同步使用新主程序名。

## 右上角双栏开关

工作区右上角提供「显示／隐藏画布」和「显示／隐藏对话栏」两个独立开关。默认两栏都显示，支持仅画布、仅对话栏、同时隐藏；同时隐藏时保留右上角恢复入口和说明。隐藏对话栏仅隐藏现有组件，保留草稿、会话和任务；恢复时退出专注状态并展开被压缩的对话栏。画布隐藏继续复用原保存、会话绑定及防重复操作逻辑。对话栏隐藏后，账号设置仍可从工作区右上角打开。

## 外部服务边界

- 原版更新源不属于 COMIC-BOX。2026-10-27 用户要求删除更新按钮及代码，现已移除设置页、版本栏更新按钮、开机检查、下载安装链路与原生 updater 插件。版本号仍显示；不接入原版安装包。此前安装验证是历史证据，不代表本次又更新了安装版。
- Gateway 源码兼容两种登录协议；MCP 授权用带 `comic-box_` 前缀的 state 区分返回的软件，原版 state 仍返回原协议。state 校验、PKCE、TTL 和一次性消费逻辑不变。此兼容代码尚未部署线上服务，不能将源码回归视为线上浏览器授权验收；账号密码和 API Key 配置仍使用原接口。
- 截图等系统全局快捷键仍遵循 Windows 占用规则，可在各自设置中配置；快捷键注册失败不会阻止程序启动。

## 源码验证

相关界面、回调、数据路径、独立安装身份、发布脚本与 Gateway 授权检查 268 项通过，前端类型检查、桌面快速构建及产物审计通过。新增用例覆盖新软件身份、私有会话目录、对比包内置页面、对话栏恢复和压缩布局的开关状态。

Gateway 完整登录测试还有一项既存下载页断言失败：旧中文安装包 URL 预期 302，现有品牌路由返回 404。撤回本次两处 Gateway 协议修改后仍能复现；该项未纳入本次相关检查通过数，未修改其行为。


## Windows 本机安装验证

本地 NSIS 对比包已生成并安装，安装器退出码 0。COMIC-BOX 安装在 `E:\software\COMIC-BOX`，原版保留在 `E:\software\jiucaibox\韭菜盒子`。两项分别出现在 Windows 卸载记录中；两个原生窗口及进程已同时打开。再次启动新安装的 COMIC-BOX 时，第二个进程正常退出并回到自己的已有窗口，原版实例保持运行。

实际目录：应用数据为 `%APPDATA%\com.comicbox.desktop`，WebView 配置为 `%LOCALAPPDATA%\com.comicbox.desktop\EBWebView`，MCP 发现位于 `%USERPROFILE%\.comic-box`。Windows `comic-box://` 注册指向新程序，`jiucaihezi://` 仍指向原程序。没有迁移原版账户配置。

安装程序主文件与从 NSIS 直接提取的最终 payload 校验一致。Tauri 会在打包时修补 bundle 类型标记，验证按最终 NSIS payload 进行，不能用打包后还原标记的 target 目录可执行文件代替。原版主程序安装前后 SHA-256 均为 `DB4ECE20F4AD9B47F30221238B8966BBBA6D626EEC36A796F7F52A0042A6DE1F`。

新软件原生窗口实测默认双栏显示、仅画布、同时隐藏、仅对话栏、恢复双栏；独立安装版重启后仍默认两栏显示。最终保留两个软件运行，COMIC-BOX 显示双栏。未执行真实付费生成、生产更新或 Gateway 部署。

首次独立安装验证时的安装包：`src-tauri/target/debug/bundle/nsis/COMIC-BOX_2.3.1_x64-setup.exe`，SHA-256 `56FCB94A61B28C9FE90AAE3BA90C1A011E07BFA92E4364C526CD40A99ED677CE`。


随后按用户要求更新为简约双格气泡 Logo，并在同一目录完成保留数据的更新安装与重启。同名构建产物的最新校验及图标验证见 [[运维/COMIC-BOX本地品牌与构建记录-2026-10-26]]。
