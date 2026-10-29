// Display names only: selection, storage and execution continue to use the original Skill name.
const labels: Record<string, string> = {
  'cinematic-four-panel-frames': '四格电影分镜',
  'h3-prompt-writing': 'H3 视频提示词',
  'jc-duanju-cehua': '短剧改编方案',
  'jc-duanju-fenji': '短剧分集规划',
  'jc-duanju-pipeline': '短剧改编流水线',
  'jc-duanju-xiezuo': '短剧逐集改编',
  'jc-film-style': '影片画面风格',
  'jc-fuzhuang-prompt': '角色服装设计',
  'jc-gongchengjuben': '工程台本',
  'jc-juese-geshi': '角色画风与排版',
  'jc-juese-sheji': '角色形象设计',
  'jc-manju-brainstorm': '漫剧创作脑暴',
  'jc-manju-pipeline': '漫剧制作流水线',
  'jc-new-user-guide': '新手指南',
  'jc-novel': '小说创作',
  'jc-prop-prompt': '道具设计提示词',
  'jc-renqun': '群演与多角色设计',
  'jc-scene-prompt': '场景设计提示词',
  'jc-seedance': 'Seedance 视频提示词',
  'jc-shengyin-daoyan': '声音导演',
  'jc-shengyin-sheji': '角色音色设计',
  'jc-watch': '看视频',
  'jc-xiangmuziliao': '项目资料',
  'seedance-storyboard-assets': 'Seedance 分镜与资产参考',
  'skill-creator': 'Skill 创建器',
}

export function skillDisplayLabel(name: string, display?: string): string {
  const preferred = display?.trim()
  return preferred && preferred !== name ? preferred : labels[name] || preferred || name
}
