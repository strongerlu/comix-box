<p align="center">
  <img src="logo.svg" alt="COMIC-BOX" width="120" />
</p>

<h1 align="center">COMIC-BOX</h1>
<p align="center"><strong>从小说到漫剧，一盒搞定。</strong></p>
<p align="center">AI 故事创作工作台</p>
<p align="center">小说创作 · 短剧改编 · 漫剧制作</p>

<p align="center">
  <a href="https://jiucaihezi.studio">jiucaihezi.studio</a>
</p>

---

## 这是什么

COMIC-BOX帮助创作者把小说改成剧本，把剧本做成漫剧。围绕同一个项目，整理原作、人物和设定，创作小说、改编分集剧本，继续制作资产、分镜和视频提示词。

Wiki 保存项目资料和创作成果，专业 Skill 提供创作方法，AI 模型与工具负责执行。桌面版支持本机项目与本地模型，也可连接云端模型。

## 三大核心业务

- **小说创作**：通过专业 Skill 辅助故事构思与正文创作，作品和设定保存在项目 Wiki 中。
- **短剧改编**：读取原作、整理项目资料、完善改编方案、逐章规划与章内分集切分，再逐集改编、自检和保存。当前专业流程聚焦改编。
- **漫剧制作**：整理项目资料与影片风格，创作角色、场景、道具、人群与换装造型提示词和工程剧本，继续生成分镜及视频提示词；支持从剧本全自动做到成片。

### 漫剧制作的三种用法

| 用法 | 做什么 | 费用 |
| --- | --- | --- |
| 自由创作 | 按你的话自动选择专业 Skill，想做哪一步做哪一步 | 只有对话费用 |
| 全自动·到提示词 | 剧本按集拆分，逐集写完项目资料、资产提示词、工程剧本和视频提示词 | 只有对话费用 |
| 全自动·到成片 | 在此基础上自动生图、审图、按参考图顺序生视频，并用 ffmpeg 拼接每集成片 | 生图、视频按集计费，开始前确认模型与单集预算 |

- 视频路线支持 **Seedance** 与 **MiniMax H3**，按所选视频模型的时长与参考图上限分段写提示词。
- 审图可单独重新生成或改提示词重生成；角色换装用身份图与服装图融合出新造型参考图。
- 三种用法共用同一套 Wiki 进度，可以随时切换接续：已写好的集不重写，已出好的图不重做。

「一盒搞定」是品牌主张。全自动成片已在真实模型上跑通单集（提示词 → 资产图 → 视频 → 拼接），字幕、配乐与审片尚未纳入；各模型渠道的稳定性与费用以实际为准。

## 配套能力

- 项目中心、文件树、Markdown 阅读编辑与 Wiki 索引
- Harness 持久对话、用户 Skill、模型与 Provider 配置、MCP
- 图片、视频、音频生成及项目媒体任务
- `.canvas`、`.jccanvas` 和桌面 `.jcscene`
- 既有文字同步能力；本地版本不提供应用内更新
- Windows 远程控制服务端：保留配对、中继、远程会话与创作控制能力；移动客户端不随本地版本维护

本地版本仅维护 Windows 桌面端，保留现有桌面能力及远程控制服务端；不再构建或交付手机 App 与网站工作台。

开发合同与知识库见 [AGENTS.md](./AGENTS.md)、[知识库首页](./docs/wiki/index.md)和[产品架构](./docs/wiki/架构/产品架构.md)。

## 技术栈

| 层 | 技术 |
| --- | --- |
| Windows 桌面壳 | Tauri v2 (Rust) |
| 前端 | Vue 3 + Pinia + TypeScript |
| 构建 | Vite 8 + pnpm |
| 渲染 | marked + highlight.js + KaTeX + Mermaid |
| 平台存储 | 本机项目目录 / IndexedDB + OPFS / App 管理目录 |

## 开发

本地 COMIC-BOX 仅维护 Windows 桌面版本。`pnpm build` / `pnpm build:quick` 分别执行桌面完整/快速构建；`pnpm tauri:dev` 启动 Windows 开发窗口。非 Windows 客户端和打包入口已清理，Gateway 的网页资源仍由其服务端使用。

新电脑的工具安装、双机分支协作、素材备份和路径迁移见 [Windows 双机 Git 开发说明](./docs/wiki/开发/COMIC-BOX双机Git协作开发.md)。先读 [AGENTS.md](./AGENTS.md)。源码与 Skill 用 Git 同步，`tmp/` 内生成素材保留本地、另行备份；忽略不等于删除，也不等于已备份。

在项目根目录的 PowerShell 中：

```powershell
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run tauri:dev
```

`tauri:dev` 会自动准备运行资源、启动 Vite 和 Windows 窗口，不需要另开 `pnpm dev`。完整检查用 `pnpm run test:focused`（包含 Rust 测试），快速桌面构建用 `pnpm run build:desktop:quick`；检查失败须保留实际结果，不能把跳过项算成通过。

## 下载

本地 COMIC-BOX 交付 Windows x64 NSIS 安装器与便携 ZIP；独立更新源尚未配置。当前仓库不构建其他平台安装包。

## 许可

本软件为专有软件。商业使用需获得授权。详见 [LICENSE](./LICENSE)。
