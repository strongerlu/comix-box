# COMIC-BOX Logo v2

使用内置 imagegen 生成，2026-10-27。用户已确认采用，并已替换应用内标识、启动画面、favicon 与 Windows 图标。

设计方向：大气但有活力。深海军蓝圆角底，米白展开的盒体/书页，亮青柠色向上扬起的盒盖。通过简洁大块面、留白和向上舒展的走势表达稳重与创作活力。

## Generation prompt

Use case: logo-brand. Design a completely NEW, exceptionally polished logo symbol for COMIC-BOX, a professional Windows AI story-creation desktop application for novels, screenwriting and comics. User's brief: 大气但有活力 — commanding, confident, spacious, energetic. Deliver ONE standalone square app icon, no presentation board, no text, no watermark, no mockup. The icon is a smoothly rounded square in rich midnight petrol/navy, with a large bold central abstract open-box / unfolding story-page symbol. Invent a memorable minimal geometric silhouette: two substantial folded page ribbons forming an open box and an implied C, one clean upward outward sweep conveying creative momentum. Strong architectural proportions and generous negative space, crisp simple vector-like edges, subtly softened corners. Main symbol is warm ivory with a restrained luminous chartreuse / fresh lime accent on the lifted upper ribbon, so it feels alive and optimistic while remaining premium and composed. Flat brand design with at most a very subtle tonal background variation; no glossy 3D, no drop shadow outside the icon, no gradients on the mark, no literal cartoon characters, no tiny details, no lightning bolt, no stars/sparkles, no generic chatbot bubble. The squircle fills approximately 88% of the canvas, perfectly centered, completely transparent outside its rounded corners. Legible as a real Windows taskbar icon at 24px. Make the visual identity distinctive, balanced, modern, confident and full of creative energy.


## 应用接入

母版为 `src-tauri/icons/app-icon.png`，与本目录获选 PNG 内容一致。执行 `node scripts/generate-icons.mjs` 可重建 8 个共享 SVG 兼容入口、根 PNG、Windows ICO/PNG 和 touch 图标。SVG 内嵌同一份 512px PNG，保留获选图形而不重新描摹；CLI 的非 Windows 产物只在临时目录生成，不回写项目。
