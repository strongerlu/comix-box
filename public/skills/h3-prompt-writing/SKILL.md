---
name: h3-prompt-writing
description: Write MiniMax H3 video generation prompts for T2VA, I2VA, FL2VA, L2VA, and Ref2VA. Use when rewriting multimodal requests into H3 prompt structures, composing integrated_multimodal_description, overall_soundscape, and non_diegetic_music, aligning keyframes, or defining reference labels for images, videos, and audio.
compatibility: Portable to any agent that can read local files — no external API calls, MiniMax Hub tools, or proprietary runtime required. The agents/openai.yaml file only adds optional ChatGPT/Codex UI metadata; it does not restrict the skill to OpenAI agents.
---

## 漫剧 Wiki 精准输入与归档

本节适用于漫剧制作。始终读取用户本轮消息，以本轮要求决定修改范围；上下文只辅助指代，不以旧聊天替代当前Wiki正文。下列“本轮应读”必须通过read实际读取正文；本轮刚生成、保存在聊天里或只读index均不算。相同版本可在本轮复用已读正文，文件修改后须重读。先wiki_read_guidance(overview)，沿真实index唯一定位，不凭人名猜路径，不把索引摘要当正文。

- 本轮应读：本集指定工程剧本或对应H3四格提示词；分镜遗漏的动作、台词、声音回查工程稿，角色声音按实际档案继承。
- 输出与保存：video_prompt，video_model=H3，segment=001等 → 剧本/视频提示词/H3/第x集001视频提示词.md。完整产物自动归档，修订先读原文并更新同一文档；解释、提问和未成稿讨论不自动保存。用户明确不要保存时遵守。
- 旧库可能使用项目资料/原作、改编版或旧资产目录，沿实际index取对应版本，不混读、不自动搬迁。缺资料先报告具体缺项；项目已有风格时不得因本轮未重复说明就采用默认写实或16:9。
- 参考图已由用户准备时，只需保证占位的对象、用途和镜号映射准确；没有绑定不能虚构真实图号或已上传状态，不重复生图。


# H3 Prompt Writing

## 全自动成片（按段选 Ref2VA 或 T2VA）

流水线指令为【全自动成片·第N集】且视频模型为 H3 时，参考图按段决定：本段 refs 不为空就按 Ref2VA（`references/ref-en.txt`）写，宿主按本段资产图生成参考视频；refs 为空（纯文生项目，或本段是空镜、氛围等无需外观一致的画面）就按 T2VA（`references/base-en.txt`）写，不出现 `<Picture N>`，主体外观在正文里写清。用户明确要求纯文生或不用参考图时一律 T2VA，不以本节默认为由暂停。Ref2VA 段的规则：

- 本段入画的角色、场景、已登记道具（仅剧情道具与角色标志物；杯碗筷、桌椅、食物等日常物件属于场景陈设，不占图）各对应一张 `<Picture N>`，从1连续编号，顺序与进度中本段 refs 一致；张数不超过指令给出的上限（如 6 张），超出就拆镜或减少本段入画资产，不合并资产。
- 换装角色用其造型资产作一张 `<Picture N>` 并写全名（如 `<Subject 1> is 顾云舟·帝王 from <Picture 1>`），不另放服装图。
- 人群用已登记的群像图作一张 `<Picture N>`（如 `<Subject 4> is the 太虚宗弟子 crowd from <Picture 4>`），镜头里写明人数与队形（如 “over one thousand disciples stand in a square formation behind <Subject 1>”），群像图只锁定服制与外观。
- `subject_definitions` 每张图单独一行并写出资产名，例如 `<Subject 1> is 顾云舟 from <Picture 1>, ...`、`<Picture 2> is the environment reference for 后山石道, ...`，名称与资产档案一致。
- 多视图参考只提供同一实体的身份或几何：人物三格中的正面、背面和脸部属于同一个人，不能变成多个演员；道具六视图不带入分格、标签和底色。成片画幅与媒介沿用已确认项目风格，参考图的三维材质不能覆盖二维成片设定。把这些取舍写入 retention_analysis 和 detailed_description，并明确本段实际入画人物数量。
- 场景图与道具图重叠展示同一实物时，继承[同物关系](../jc-xiangmuziliao/SKILL.md#场景与道具的同物关系)，在 subject_definitions 的场景行与道具行明确它们共同指向同一个实物：场景图锁位置，道具图补外观；仅补关系时保持现有 Picture 编号和 refs，不另造一个道具主体。retention_analysis 写清保留的场内位置、实际数量及舍弃的重复摆放，detailed_description 各镜按该位置取景；固定物体的特写改变相机，不另添前景副本。真实多个同类物仍按资料逐个区分，不默认全片只有一件。
- 实际审片仍出现重复实物，且场景参考已足以呈现本段所需道具时，在局部重做范围内减少该段重复的独立道具参考，改由场景图统一承载身份与位置；同步修改正文 Picture 引用及检查点有序 refs，重新校验，不只删图片参数。保留道具档案、已锁定图片及无关片段，不把本次实测推为所有项目都不带道具图。
- 每段都写清参考图与角色空间关系：谁在画面哪一侧、距离、朝向、视线、持物，以及场景地标的位置；不能只写“沿用上一段”。每段独立可提交，时间从0起，时长不超过指令上限。
- 参考图提供身份与环境时，明确它是否也约束构图，避免人物设定图的正面或特写构图替换工程稿景别。连续表演不需要切镜时只写一个 Shot，在镜内安排动作时间；确需切镜才另编号。局部动作分别说明活动部位与保持不动的部位，并核对首帧位置、人物尺度和末态能否接到相邻段；不把“回望”等动词自动扩成全身转向。
- 按[工程剧本的时序与跨镜连续性](../jc-gongchengjuben/SKILL.md#时序与跨镜连续性)转写：subject_definitions 与 retention_analysis 区分稳定身份和随剧情变化的状态，不能把某镜的结果覆盖全段；summary、detailed_description、overall_soundscape、non_diegetic_music 使用同一事件顺序与状态边界。逐镜时间在本段内递增并覆盖目标长度，来源全片时间先减段起点；同步动作、持续变化和原稿明确的非顺叙按原意保留，不套固定等待秒数。
- 角色声音按人物声音档案写进对白与 soundscape；不写制作备注、上传说明或预算。
- 声音承接以已确认工程稿和当前用户要求为依据；没有来源的配乐不能写成“继续上一段音乐”。用户要求静音、无配乐或只留环境声时，逐节检查 summary、retention_analysis、detailed_description 与两节声音描述，去掉冲突，不只修改 non_diegetic_music。已有明确音乐设计的项目仍按其要求保留。

## Workflow

1. Identify the input mode: T2VA, I2VA, FL2VA, L2VA, or full-reference Ref2VA.
2. For base text/keyframe modes, read `references/base-en.txt` and follow its final prompt structure.
3. For full-reference mode, read `references/ref-en.txt` and follow its six-section rewrite format.
4. Preserve the exact field names, section order, labels, and timing notation from the selected guide.

## Base Modes

- T2VA: build the full audiovisual timeline from text.
- I2VA: start from the first frame and develop forward from it.
- FL2VA: describe the continuous path between the first and last frames.
- L2VA: infer a plausible opening and converge to the supplied last frame.

Use `integrated_multimodal_description`, `overall_soundscape`, and `non_diegetic_music` in the order shown in `references/base-en.txt`.

## Full-Reference Mode

Ref2VA rewrites use `subject_definitions`, `summary`, `retention_analysis`, `detailed_description`, `overall_soundscape`, and `non_diegetic_music` in that order. Reference labels stay consistent across all sections.

Read `references/ref-en.txt` for label rules, retention analysis, and complete examples.

## Output Rules

- Write rewrite sections in English; preserve dialogue, lyrics, and visible scene text in their original language.
- Describe each shot by composition, subjects, environment, actions, camera, sound, and the exact point where referenced content appears.
- Avoid plot summaries, unresolved reference labels, and timing that does not match the requested duration.
## Tips for Better Results
- Always match the total duration of the description to the requested video length (4–30 seconds; in the 漫剧 pipeline use the plan's `limits.max_seconds`).
- Keep reference labels consistent (e.g. `<Picture 1>`, `<Video 1>`, `<Audio 1>`) across every section.
- Prefer concrete visual and audio details over abstract words like "cinematic" or "beautiful".
- When using keyframes (I2VA / FL2VA / L2VA), clearly state how the first and/or last frame connects to the timeline.
