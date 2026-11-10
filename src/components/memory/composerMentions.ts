import type { Ref } from 'vue'
import type { ProjectResource } from '@/utils/projectResource'
import { skillDisplayLabel } from '@/utils/skillDisplayLabel'
import { sortSkillsForPicker } from '@/utils/skillPickerOrder'
import { MANJU_SKILLS, WIKI_MEMORY_SKILL } from '@/runtime/memory/manjuProduction'
import { NOVEL_SKILLS } from '@/runtime/memory/novelProduction'
import { SHORT_DRAMA_SKILLS } from '@/runtime/memory/shortDramaProduction'
import type { ComposerSkillOption } from './ComposerSkillPicker.vue'

export type MemoryMentionOption =
  | { type: 'tool'; id: string; display: string; description: string; icon: string }
  | { type: 'command'; id: string; display: string; description: string; icon: string }
  | { type: 'file'; display: string; description: string; resource: ProjectResource }
  | ComposerSkillOption
  | { type: 'session'; id: string; display: string; description: string; conversationId: string }

export type MentionScope = 'all' | 'skill' | 'mcp' | 'session'

export interface MentionSource {
  open: Readonly<Ref<boolean>>
  scope: Readonly<Ref<MentionScope>>
  trigger: Readonly<Ref<'@' | '/' | null>>
  desktop: boolean
  owner: () => string
  conversations: () => Array<{ resource: { owner: string }; transcript: { id: string; title: string } }>
  currentConversationId: () => string | undefined
  mcpTools: () => Array<{ serverId: string }>
  loadBundledSkills: () => Promise<Array<{ name: string; displayName?: string; description?: string | null }>>
  customSkills: () => Array<{ name: string; description: string; enabled?: boolean }>
  route: () => { manju: boolean; novel: boolean; shortDrama: boolean }
  searchPaths: (owner: string, query: string, limit: number) => Promise<ProjectResource[]>
  isOfficeResource: (resource: ProjectResource) => boolean
}

export const mentionKey = (item: MemoryMentionOption) => item.type === 'tool'
  ? `tool:${item.id}`
  : item.type === 'command'
    ? `command:${item.id}`
  : item.type === 'skill'
  ? `skill:${item.name}`
  : item.type === 'file'
    ? `file:${item.resource.path}`
    : `session:${item.conversationId}`

/**
 * 输入框 @ 与 / 的候选加载。芯片入口只加载对应候选；手打 @ 时给全套候选。
 * 加载中途关闭或切换范围时返回空，避免旧结果覆盖新菜单。
 */
export function createMentionItems(source: MentionSource) {
  return async (query: string): Promise<MemoryMentionOption[]> => {
    if (!source.open.value) return []
    const scope = source.scope.value
    const desktop = source.desktop
    const mcpByServer = new Map<string, number>()
    for (const tool of source.mcpTools() || []) {
      mcpByServer.set(tool.serverId, (mcpByServer.get(tool.serverId) || 0) + 1)
    }
    const mcpTools: MemoryMentionOption[] = [...mcpByServer.entries()].map(([serverId, count]) => ({
      type: 'tool', id: `mcp__${serverId}`, display: `MCP · ${serverId}`,
      description: `整体工具（${count} 个 operation）`, icon: 'extension',
    }))
    if (scope === 'mcp' || query.trim().startsWith('mcp__')) return mcpTools
    const owner = source.owner()
    const sessionOptions = (): MemoryMentionOption[] => source.conversations()
      .filter(item => item.resource.owner === owner && item.transcript.id !== source.currentConversationId())
      .map(item => ({
        type: 'session', id: item.transcript.id, conversationId: item.transcript.id,
        display: item.transcript.title, description: '引用该对话最近 12 条用户/助手消息',
      }))
    if (scope === 'session') return desktop ? sessionOptions() : []
    // 与芯片排保持一致：本机文件与终端由底部「权限」档直接控制（旧称 @文件），
    // 不再单列；3D 是桌面独有。
    const toolOptions: MemoryMentionOption[] = [
      ...(desktop ? [{ type: 'tool' as const, id: 'wiki', display: 'Wiki Memory', description: '查询、整理项目资料与归档创作成果', icon: 'description' }] : []),
      { type: 'tool', id: 'skill', display: 'Skill', description: '加载指定 Skill', icon: 'psychology' },
      ...(desktop
        ? [{ type: 'tool' as const, id: 'scene3d', display: '3D', description: '创建或编辑 3D 场景', icon: 'view-in-ar' }]
        : []),
      { type: 'tool', id: 'media', display: 'Office', description: '导出文档、表格、幻灯片、PDF、网页和长图', icon: 'image' },
      { type: 'tool', id: 'av', display: '影音', description: '生成图片、视频和音频', icon: 'movie' },
      { type: 'tool', id: 'mcp', display: 'MCP', description: '调用已连接的 MCP 工具', icon: 'extension' },
    ]
    const sessionTool: MemoryMentionOption = {
      type: 'tool', id: 'session', display: '会话', description: '引用当前项目的其他对话', icon: 'chat',
    }
    const sessionToolOptions = desktop ? [sessionTool] : []
    if (source.trigger.value === '/') {
      return toolOptions.map(option => option.type === 'tool'
        ? { type: 'command', id: option.id, display: `/${option.id}`, description: option.description, icon: option.icon }
        : option)
    }
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (scope !== 'skill' && normalizedQuery) {
      const matchingTools = toolOptions.filter(option => option.type === 'tool'
        && (option.id.toLocaleLowerCase() === normalizedQuery || option.display.toLocaleLowerCase() === normalizedQuery),
      )
      if (matchingTools.length) return matchingTools
    }
    const bundledSkills = await source.loadBundledSkills().catch(() => [])
    if (!source.open.value || source.scope.value !== scope) return []
    const skillOptions = [
      ...bundledSkills.filter(skill => skill.name !== 'wiki-memory').map(skill => ({
        type: 'skill' as const,
        display: skillDisplayLabel(skill.name, skill.displayName),
        description: skill.description || 'COMIC-BOX内置 Skill',
        name: skill.name,
        source: 'builtin' as const,
      })),
      ...source.customSkills()
        .filter(skill => skill.enabled !== false)
        .map(skill => ({
          type: 'skill' as const,
          display: skill.name,
          description: skill.description,
          name: skill.name,
          source: 'custom' as const,
        })),
    ]
    const route = source.route()
    const seenSkillNames = new Set<string>()
    const skills = sortSkillsForPicker(skillOptions.filter(skill => {
      if (seenSkillNames.has(skill.name)) return false
      seenSkillNames.add(skill.name)
      return true
    }).map(skill => ({
      ...skill,
      unavailableReason: route.manju && !MANJU_SKILLS.includes(skill.name) && skill.name !== WIKI_MEMORY_SKILL
        ? '请先退出漫剧制作，再选择此 Skill'
        : route.novel && !NOVEL_SKILLS.includes(skill.name) ? '请先退出小说创作，再选择此 Skill'
          : route.shortDrama && !SHORT_DRAMA_SKILLS.includes(skill.name) ? '请先退出短剧改编，再选择此 Skill' : undefined,
    })))
    // 从芯片排的「@Skill」进来时只列 Skill：下面的芯片排已经有全部工具入口了。
    if (scope === 'skill') return skills
    const availableSkills = skills.filter(skill => !skill.unavailableReason)
    // Empty @ shows tools and recent skills without recursively enumerating up to 1,000 project files.
    const resources = !owner || !normalizedQuery
      ? []
      : await source.searchPaths(owner, query.trim(), 40)
    const projectOptions = resources
      .filter(resource => !resource.isDirectory
        && !resource.path.startsWith('.raw/对话记录/')
        && (resource.kind !== 'binary' || source.isOfficeResource(resource)))
      .slice(0, 40)
      .map(resource => ({
        type: 'file' as const,
        display: resource.path,
        description: resource.kind === 'media' ? '项目媒体' : '项目文件',
        resource,
      }))
    return query.trim()
      ? [...toolOptions, ...sessionToolOptions, ...availableSkills, ...mcpTools, ...projectOptions, ...(desktop ? sessionOptions() : [])]
      : [...toolOptions, ...sessionToolOptions, ...availableSkills.slice(0, 5), ...mcpTools, ...projectOptions, ...(desktop ? sessionOptions().slice(0, 3) : [])]
  }
}
