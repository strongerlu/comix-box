# COMIC-BOX Windows 双机 Git 开发说明

本项目仅以 Windows 桌面版本开发与验收。先读根目录 `AGENTS.md`，再按知识库导航查对应专题。两台电脑分别克隆仓库、分别安装依赖、使用独立的应用配置；不通过网盘同步正在使用的 `.git`、依赖、编译缓存或应用数据库。

## 源码与创作数据的边界

| 内容 | 保存与同步方式 |
| --- | --- |
| 源码、测试、`public/skills`、工作流模板、开发文档 | 纳入 Git，按任务分支提交 |
| 根 `pnpm-lock.yaml`、Rust `Cargo.lock`、Harness `package-lock.json` 等现有锁文件 | 纳入 Git；修改哪个依赖包就同步修改对应清单与锁文件 |
| 应用 Logo、图标、`src-tauri/resources/storyboarder` 模型资源、明确的小型测试夹具 | 继续纳入 Git，它们是应用/测试依赖，不能按扩展名批量忽略 |
| `tmp/` 中的样片项目、`.raw` 原素材、Wiki 进度、成片、验收输出 | 原位保留，由共享 `.gitignore` 忽略，另行备份/传输；不会随 Git 拉取 |
| `node_modules`、`src-tauri/target`、`dist`、Python `.venv`、TypeScript 构建缓存、根目录日志 | 本机生成，忽略并在各自电脑重建 |
| `.env`、`.env.*`、`.comic-box` 私有数据 | 保持本机私有；不把真实 Key、令牌或个人地址提交进源码 |
| 无真实凭据的 `.env.example`、`.env.*.example`、`.env.template` | 可以共享，填写占位符与必要说明 |

当前忽略规则按目录和用途限定，没有全局忽略 `.png`、`.mp4`、`.json`、`.glb` 或全部日志。需要长期复现的最小测试夹具应放进相应测试目录，避免让源码测试依赖被忽略的 `tmp/`；大样片和模型权重放独立素材位置，不通过强制添加塞入普通 Git 历史。

**忽略只控制未跟踪文件的显示和添加，不会删除文件，也不会自动备份或移除已经跟踪的文件。** 已存在的历史证据、用户改动与删除记录都应按原任务审查；不要用 `git rm --cached`、整仓还原或历史重写来“整理”它们。尤其不能对存有唯一素材的工作区执行 `git clean -fdx` / `git clean -fdX`。

## 新电脑的 Windows 环境

安装 Git、Node.js、pnpm、Rust MSVC 工具链、Visual Studio C++ Build Tools（包含 C++ 桌面开发与 Windows SDK）和 WebView2。系统依赖参考 [Tauri Windows 前置要求](https://v2.tauri.app/start/prerequisites/)。视频拼接/提帧还需 FFmpeg 和 ffprobe 可用；配置工具目录或加入 PATH 后重启应用。

- 主项目 `package.json` 声明 **pnpm 10.33.2**，两边按它统一；不要混用 npm/yarn 安装根项目、生成另一种根锁文件。新电脑可以执行 `npm install --global pnpm@10.33.2`，或用已有版本管理器安装这个版本。
- 本机此前验证使用的宿主 Node 为 **22.22.1**、Rust 为 **1.98.0**（MSVC）；新机器优先对齐，不在迁移的同时升级依赖。本次整理没有切换本机工具链；先前实际 pnpm 为9.14.2，不能把此前测试结果写成10.33.2的新机验证。
- Harness 自己的 Node/SDK 版本由 `src-tauri/resources/deepseek-harness/package.json` 和其锁文件维护，与宿主 Node 区分。启动脚本会在需要时执行该子项目的 `npm ci`，不要因此改用 npm 安装根项目。
- 只有使用 ComfyUI MCP 等 Python 工具时才需相应 Python 环境；按应用「设置 → MCP」显示的版本与命令安装。每台电脑分别配置可执行文件路径与 GPU 服务器地址，不把本机路径写死进共享源码。

克隆用户自己的远端仓库后，在新目录打开 PowerShell（目录不要求保留原盘符）：

```powershell
git status --short
node --version
pnpm --version
rustc --version
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run tauri:dev
```

`tauri:dev` 会准备运行资源、启动 Vite 和 Windows 窗口；不需要同时另开 `pnpm dev`，以免争用1420端口。首次会下载和编译依赖。不要把旧电脑的 `node_modules` 或 `target` 当成新电脑安装步骤。

## 日常两机协作

以下流程要求本地现有改动已审查并提交，或已明确妥善保存；当前这次整理不会自动替用户提交此前积累的修改。

1. 每个任务建独立分支，例如电脑A用 `codex/continuity-planning`，电脑B用 `codex/comfyui-local`。先从最新 `main` 开始，不让两台电脑同时往同一任务分支写入。
2. 开工前查看状态、获取远端并更新主分支；有未提交文件时先处理，不能直接覆盖：

   ```powershell
   git status --short
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c codex/your-task
   ```

   `origin` 代表你实际配置的远端，`your-task` 换成具体任务名。已有任务分支直接切换并拉取，不重复创建。

3. 修改前协调文件范围。视频调度、Wiki 保存工具、对应 Skill 和数据格式常需联动；一方改变接口，另一方同步调整调用与测试。避免两个任务各自实现不同版本的同一字段。
4. 按任务显式选择要暂存的文件，用 `git diff --cached` 检查源码、锁文件、文档和必要资源是否齐全，确认没有个人配置或素材；保留原任务中的必要删除。不要盲目整仓暂存，也不要只提交已跟踪文件而漏掉新建源码。
5. 完成相关检查后提交、推送任务分支，通过 PR 审查并合入 `main`。冲突按双方意图解决，不整批选择“保留本地/远端”。不要强推共享 `main`；普通拉取失败先看差异，不用 reset 清空现场。
6. 换电脑接着同一任务时，原电脑先提交并推送该分支，新电脑再获取、切换并拉取；交接后由新电脑继续写，避免两边并行写同一分支。Git stash、未提交文件、`.git` 内本机快照不会通过 push 同步。

依赖变化后先执行 `pnpm install --frozen-lockfile`；清单与锁文件不一致时回到该依赖变更解决，不删除锁文件重新生成以掩盖差异。仓库现有 `.gitattributes` 已规定文本 LF、`.bat/.cmd` CRLF；保留该规则，不顺手整仓格式化或重新规范化换行符。

## 合并前验证

先跑与修改相关的测试和 `pnpm run typecheck`。共享忽略规则有独立回归：

```powershell
node --test scripts/__tests__/git-collaboration.test.mjs
```

需要完整验证时：

```powershell
pnpm run test:focused:build
pnpm run test:focused:run
pnpm run test:tauri
pnpm run build:desktop:quick
```

也可以用 `pnpm run test:focused` 顺序执行 focused 构建、运行和 Rust 测试。`build:desktop:quick` 准备桌面资源并验证前端分发，不等于 Windows 原生测试或安装包发布；`tauri:dev` 会编译启动原生窗口。此次整理前，本机完整 Rust 测试宿主存在 `0xc0000139` 的已记录阻断；换机后应重新验证，不能算作通过。实际平台、真实生成和未执行的检查按事实记录。

## 素材、应用配置与绝对路径迁移

本地 `tmp/` 已包含创作成果，不是可随便丢弃的缓存。首次换机前关闭项目写入，单独备份完整创作项目目录，包含 `.raw`、Wiki、进度、参考图和成片；只拷贝交付MP4会丢失继续编辑与任务恢复所需信息。备份可以放到个人外置盘或受控素材存储，核对文件数量/大小及关键文件 SHA-256 后保留原件。源码提交、Git远端、当前 `.git` 内快照均不替代这份备份。

新电脑可把创作项目放在仓库之外，再从 COMIC-BOX 重新打开。历史任务与素材可能记录旧绝对路径，检查参考图、视频预览、输出目录和版本恢复；逐项迁移，不批量替换二进制文件或整个配置库里的盘符。不因为旧路径失效就重新提交生成；同一创作项目采用单机写入、关闭后交接，不能让两台电脑同时覆盖共享文件夹或重复恢复同一个生成任务。

应用配置在源码仓库外还包括：

- `%USERPROFILE%\.comic-box`：CLI、会话和工具等私有资料，可能含密钥。
- `%APPDATA%\com.comicbox.desktop`：应用数据。
- `%LOCALAPPDATA%\com.comicbox.desktop\EBWebView`：WebView 配置与状态。
- Windows 凭据管理器：凭据不能通过复制 Git 仓库迁移，API Key 建议在新电脑重新填写。

新电脑重新添加项目并配置模型/MCP即可开始源码开发，不要求复制上述所有用户数据。需要历史会话时，两端关闭应用后另做私有备份与迁移；不要把这些目录或登录状态提交到仓库。仍保留 COMIC-BOX 的独立身份，不覆盖原版韭菜盒子数据。

## 2026-10-29 本次整理记录

- 只调整共享忽略规则、开发入口、本文及导航/日志，并为忽略边界增加 focused 回归；没有删除、搬移、暂存、提交或推送现有代码与生成素材，也没有变更已跟踪文件清单。
- `tmp/` 新增根目录忽略；补齐本机环境配置、虚拟环境、构建缓存与根日志忽略。应用资源、工作流、Skill、锁文件、历史文档和新建源码继续可见。
- 修改前盘点与内容摘要保存在本地 `.git/collab-prep-20261029/`；核验结果见该目录 `verification.json`。这些本机证据不随Git推送，不能代替异机备份。
- 对2449个原有文件做内容摘要核验；除本次明确修改的忽略规则、README、导航、日志和 focused 注册脚本外，其余内容无变化、无丢失。`tmp/` 全部651个文件合计332581258字节保持原内容，已跟踪文件清单不变，没有已跟踪文件命中忽略规则。
- 忽略边界测试先复现 `/tmp/` 等缺口，再通过修复；新增测试与既有 Windows 范围、独立身份测试共10项通过，日志 `validation.log`。focused 测试构建通过，新测试已注册进完整 focused 测试列表；本轮只改协作配置/文档，没有重复跑整个应用套件或执行新机、模型生成测试。
- 整理完成时仍有此前积累的未提交修改与新文件，当时尚未建立/推送新的共同基线；后续提交和推送状态以 Git 记录为准。第二台电脑尚未实测。
