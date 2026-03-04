import type { ChatEvent, ProcessBlock } from './chats.js'

export type RenderItem =
  | { kind: 'text'; speaker: string; timestamp: string; isUser: boolean; content: string }
  | {
      kind: 'directive'
      speaker: string
      timestamp: string
      isUser: boolean
      type: string
      icon: string
      label: string
      content: string
      collapsed: boolean
    }

/** Returns true when a speaker name belongs to an AI agent rather than a human. */
export function isSpeakerAgent(speaker: string, participants?: Record<string, { role: string }>): boolean {
  if (participants && speaker in participants) {
    return participants[speaker].role === 'agent'
  }
  const lower = speaker.toLowerCase()
  return lower.includes('agent')
}

/** Wraps content in a fenced code block, adapting fence length to avoid conflicts. */
export function fenceBlock(content: string): string {
  let maxRun = 2
  for (const m of content.matchAll(/`+/g)) {
    if (m[0].length > maxRun) {
      maxRun = m[0].length
    }
  }
  const fence = '`'.repeat(maxRun + 1)
  return `${fence}\n${content}\n${fence}`
}

/** Formats a tool call as a markdown string for the collapsible body. */
export function buildToolCallContent(tc: Extract<ProcessBlock, { type: 'tool_call' }>): string {
  const argLines: string[] = []

  switch (tc.name) {
    case 'read': {
      const fp = tc.arguments.file_path as string | undefined
      if (fp) {
        argLines.push(`**File**: \`${fp}\``)
      }
      break
    }
    case 'write': {
      const fp = tc.arguments.file_path as string | undefined
      const content = tc.arguments.content as string | undefined
      if (fp) {
        argLines.push(`**File**: ${fp}`)
      }
      if (content) {
        argLines.push(`**Content** (${content.length} chars):\n${fenceBlock(content)}`)
      }
      break
    }
    case 'edit': {
      const fp = tc.arguments.file_path as string | undefined
      const oldText = tc.arguments.oldText as string | undefined
      const newText = tc.arguments.newText as string | undefined
      if (fp) {
        argLines.push(`**File**: ${fp}`)
      }
      if (oldText) {
        argLines.push(`**Old**:\n${fenceBlock(oldText)}`)
      }
      if (newText) {
        argLines.push(`**New**:\n${fenceBlock(newText)}`)
      }
      break
    }
    case 'exec': {
      const command = tc.arguments.command as string | undefined
      if (command) {
        argLines.push(`**Command**:\n${fenceBlock(command)}`)
      }
      break
    }
    case 'process': {
      const name = tc.arguments.name as string | undefined
      const command = tc.arguments.command as string | undefined
      if (name) {
        argLines.push(`**Process**: ${name}`)
      }
      if (command) {
        argLines.push(`**Command**:\n${fenceBlock(command)}`)
      }
      break
    }
    case 'curl': {
      const method = tc.arguments.method as string | undefined
      const url = tc.arguments.url as string | undefined
      const body = tc.arguments.body as string | undefined
      if (method) {
        argLines.push(`**Method**: ${method}`)
      }
      if (url) {
        argLines.push(`**URL**: ${url}`)
      }
      if (body) {
        argLines.push(`**Body**:\n${fenceBlock(body)}`)
      }
      break
    }
    default: {
      for (const [key, value] of Object.entries(tc.arguments)) {
        const strValue = typeof value === 'string' ? value : JSON.stringify(value)
        argLines.push(`**${key}**:\n${fenceBlock(strValue)}`)
      }
    }
  }

  const parts: string[] = []
  if (argLines.length > 0) {
    parts.push(argLines.join('\n\n'))
    parts.push('***')
  }
  if (tc.result) {
    parts.push(tc.result.isError ? tc.result.content : fenceBlock(tc.result.content))
  }
  return parts.join('\n\n')
}

/** Maps a non-message timeline event to collapsible directive display properties. */
export function expandEventToDirective(event: ChatEvent): {
  type: string
  icon: string
  label: string
  content: string
  collapsed: boolean
} {
  const e = event as Record<string, unknown>
  const content = String(e.content || '')
  const title = e.title ? String(e.title) : null
  const collapsed = Boolean(e.collapsed ?? false)
  switch (event.type) {
    case 'session':
      return { type: 'session', icon: '✅', label: title ?? `Session Initialized ${e.cwd || ''}`, content, collapsed }
    case 'model_change':
      return {
        type: 'custom',
        icon: '⚙️',
        label: title ?? `Model Change: ${e.model || ''} (${e.provider || ''})`,
        content,
        collapsed,
      }
    case 'thinking_level_change':
      return {
        type: 'thinking_level_change',
        icon: '🧠',
        label: title ?? `Thinking level: ${e.level || ''}`,
        content,
        collapsed,
      }
    case 'compaction':
      return {
        type: 'custom',
        icon: '🗜️',
        label: title ?? `Context Compaction: ${e.tokensBefore ?? ''} tokens`,
        content,
        collapsed,
      }
    case 'custom': {
      const customType = String(e.customType || 'custom')
      if (customType === 'model-snapshot') {
        return {
          type: 'custom',
          icon: '🔧',
          label: title ?? `Model Snapshot: ${e.model || ''} (${e.provider || ''})`,
          content,
          collapsed,
        }
      }
      return { type: 'custom', icon: '⚙️', label: title ?? customType, content, collapsed }
    }
    default:
      return { type: 'custom', icon: '⚙️', label: title ?? event.type, content, collapsed }
  }
}
