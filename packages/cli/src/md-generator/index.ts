/**
 * MD File Generator
 * Generates markdown files from parsed session data using format constraints
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { FormatConstraint } from '../format-constraint/index.js'
import type { ParsedMessage, ParsedSession, SessionEvent } from '../session-log-parser/index.js'

export interface GeneratorOptions {
  includeFrontMatter?: boolean
  includeTimestamps?: boolean
  indentSize?: number
}

const DEFAULT_OPTIONS: GeneratorOptions = {
  includeFrontMatter: true,
  includeTimestamps: true,
  indentSize: 2,
}

/**
 * Calculate total tokens
 */
function calculateTotalTokens(messages: ParsedMessage[]): number {
  return messages.reduce((sum, m) => {
    return sum + (m.usage?.totalTokens || 0)
  }, 0)
}

/**
 * MD File Generator
 */
export class MDGenerator {
  private constraint: FormatConstraint
  private options: GeneratorOptions

  constructor(constraint: FormatConstraint, options: GeneratorOptions = {}) {
    this.constraint = constraint
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Generate markdown content from parsed session (flat chronological format)
   */
  generate(session: ParsedSession): string {
    const title = this.constraint.name || 'Session Export'
    const parts: string[] = []

    // Title heading and date header (no separator between them)
    const sessionDate = session.meta.timestamp.split('T')[0]
    parts.push(`# ${title}\n\n> ${sessionDate}`)

    // Build a map of toolCallId -> toolResult for linking tool calls with results
    // Also build a set of toolCall IDs that exist in the session
    const toolResultMap = new Map<string, ParsedMessage>()
    const toolCallIds = new Set<string>()
    for (const msg of session.messages) {
      if (msg.role === 'toolResult' && msg.toolResult?.toolCallId) {
        toolResultMap.set(msg.toolResult.toolCallId, msg)
      }
      if (msg.role === 'assistant' && msg.toolCall?.id) {
        toolCallIds.add(msg.toolCall.id)
      }
    }

    // Merge messages and non-message events, sort by timestamp
    type TimelineItem =
      | { timestamp: string; kind: 'message'; data: ParsedMessage }
      | { timestamp: string; kind: 'event'; data: SessionEvent }

    const timeline: TimelineItem[] = [
      ...session.messages.map(m => ({ timestamp: m.timestamp, kind: 'message' as const, data: m })),
      ...session.events.map(e => ({ timestamp: e.timestamp, kind: 'event' as const, data: e })),
    ]
    timeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    for (const item of timeline) {
      if (item.kind === 'message') {
        // Skip toolResult messages that have a corresponding toolCall (they're rendered with the toolCall)
        // Check if there's actually a toolCall message for this toolResult
        if (
          item.data.role === 'toolResult' &&
          item.data.toolResult?.toolCallId &&
          toolCallIds.has(item.data.toolResult.toolCallId)
        ) {
          continue
        }
        // Pass toolResultMap to renderMessage for linking
        parts.push(this.renderMessage(item.data, toolResultMap))
      } else {
        const block = this.renderEvent(item.data)
        if (block) {
          parts.push(block)
        }
      }
    }

    return parts.join('\n\n---\n\n')
  }

  /**
   * Generate with YAML front matter
   */
  generateWithFrontMatter(session: ParsedSession): string {
    const frontMatter = this.buildFrontMatter(session)
    const content = this.generate(session)
    return `${frontMatter}\n\n${content}`
  }

  /**
   * Render a single message block
   */
  private renderMessage(msg: ParsedMessage, toolResultMap?: Map<string, ParsedMessage>): string {
    const isToolResult = msg.role === 'toolResult'
    const role = isToolResult ? 'tool' : msg.role
    const header = this.options.includeTimestamps ? `**${role}** · ${msg.timestamp}` : `**${role}**`

    // For toolResult messages, don't show message header - just render the tool result block
    const blocks: string[] = isToolResult ? [] : [header, '']

    // Thinking block (only for non-toolResult messages)
    if (msg.thinking && !isToolResult) {
      blocks.push(`:::{type=thinking_level_change,collapsed=true}`)
      blocks.push(`🧠 **Thinking**`)
      blocks.push(msg.thinking)
      blocks.push(`:::`)
      blocks.push('')
    }

    // Text content (only for non-toolResult messages)
    if (msg.content && !isToolResult) {
      blocks.push(msg.content)
    }

    // Tool call - include tool result if available
    if (msg.toolCall && !isToolResult) {
      const argDesc = msg.toolCall.arguments.file_path ? ` · ${msg.toolCall.arguments.file_path}` : ''
      blocks.push('')

      // Check if there's a corresponding toolResult
      const toolResultMsg = msg.toolCall.id ? toolResultMap?.get(msg.toolCall.id) : undefined

      if (toolResultMsg?.toolResult) {
        // Render tool call and result together in one block
        const tr = toolResultMsg.toolResult
        const icon = tr.isError ? '❌' : '✅'
        const blockType = tr.isError ? 'error' : 'custom'
        const collapsed = tr.isError ? 'false' : 'true'
        blocks.push(`:::{type=${blockType},collapsed=${collapsed}}`)
        blocks.push(`🔧 **${msg.toolCall.name}**${argDesc}`)
        blocks.push(`${icon} **${tr.toolName}** · ${tr.content}`)
        blocks.push(`:::`)
      } else {
        // No result yet - just show the tool call
        blocks.push(`:::{type=custom,collapsed=true}`)
        blocks.push(`🔧 **${msg.toolCall.name}**${argDesc}`)
        blocks.push(`:::`)
      }
    }

    // Legacy toolResult rendering (for messages that have toolResult but are not standalone)
    if (msg.toolResult && !msg.toolCall) {
      const icon = msg.toolResult.isError ? '❌' : '✅'
      const blockType = msg.toolResult.isError ? 'error' : 'custom'
      const collapsed = msg.toolResult.isError ? 'false' : 'true'
      if (!isToolResult) {
        blocks.push('')
      }
      blocks.push(`:::{type=${blockType},collapsed=${collapsed}}`)
      blocks.push(`${icon} **${msg.toolResult.toolName}** · ${msg.toolResult.content}`)
      blocks.push(`:::`)
    }

    return blocks.join('\n')
  }

  /**
   * Render a non-message event as a fenced directive block
   */
  private renderEvent(event: SessionEvent): string | null {
    const e = event as Record<string, unknown>
    switch (event.type) {
      case 'model_change': {
        const modelId = String(e.modelId || '')
        const provider = e.provider ? ` (${e.provider})` : ''
        return `:::{type=custom,collapsed=true}\nModel changed: ${modelId}${provider}\n:::`
      }
      case 'thinking_level_change': {
        const level = String(e.thinkingLevel || '')
        return `:::{type=thinking_level_change,collapsed=true}\n🧠 **Thinking** level: ${level}\n:::`
      }
      case 'custom': {
        const customType = String(e.customType || 'custom')
        const data = e.data as Record<string, unknown> | undefined
        let desc = customType
        if (customType === 'model-snapshot' && data) {
          const modelId = String(data.modelId || '')
          const provider = data.provider ? ` (${data.provider})` : ''
          desc = `Model snapshot: ${modelId}${provider}`
        }
        return `:::{type=custom,collapsed=true}\n${desc}\n:::`
      }
      case 'compaction': {
        const tokens = e.tokensBefore ?? ''
        return `:::{type=custom,collapsed=true}\nContext compacted (${tokens} tokens)\n:::`
      }
      case 'session': {
        const cwd = e.cwd ? ` (${e.cwd})` : ''
        return `:::{type=session,collapsed=true}\nSession started${cwd}\n:::`
      }
      default:
        return null
    }
  }

  /**
   * Build YAML front matter
   */
  private buildFrontMatter(session: ParsedSession): string {
    const metadata: Record<string, unknown> = {}

    for (const field of this.constraint.metadata) {
      const value = this.getMetadataValue(field.key, session)
      if (value !== undefined) {
        metadata[field.key] = value
      }
    }

    const yaml = this.objectToYaml(metadata)
    return `---\n${yaml}---`
  }

  /**
   * Get metadata value from session
   */
  private getMetadataValue(key: string, session: ParsedSession): unknown {
    switch (key) {
      case 'title':
        return this.constraint.name || 'Session Export'
      case 'date':
        return session.meta.timestamp.split('T')[0]
      case 'sessionId':
        return session.meta.id
      case 'model':
        return session.messages.find(m => m.model)?.model || 'unknown'
      case 'totalMessages':
        return session.messages.length
      case 'totalTokens':
        return calculateTotalTokens(session.messages)
      case 'participants': {
        const map: Record<string, { role: 'human' | 'agent'; model?: string }> = {}
        for (const m of session.messages) {
          if (m.role === 'user' && !('user' in map)) {
            map.user = { role: 'human' }
          } else if ((m.role === 'assistant' || m.role === 'toolResult') && !('assistant' in map)) {
            map.assistant = { role: 'agent', ...(m.model ? { model: m.model } : {}) }
          }
        }
        return Object.keys(map).length > 0 ? map : undefined
      }
      case 'visibility':
        return 'private'
      // Manual fields - return undefined to allow manual addition
      case 'channel':
      case 'tags':
      case 'description':
        return undefined
      default:
        return undefined
    }
  }

  /**
   * Simple object to YAML converter
   */
  private objectToYaml(obj: Record<string, unknown>, indent = 0): string {
    const prefix = ' '.repeat(indent)
    let output = ''

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) {
        continue
      }

      if (Array.isArray(value)) {
        output += `${prefix}${key}:\n`
        for (const item of value) {
          if (typeof item === 'string') {
            output += `${prefix}  - ${item}\n`
          } else if (typeof item === 'object') {
            output += `${prefix}  -\n${this.objectToYaml(item as Record<string, unknown>, indent + 4)}`
          }
        }
      } else if (typeof value === 'object') {
        output += `${prefix}${key}:\n${this.objectToYaml(value as Record<string, unknown>, indent + 2)}`
      } else {
        output += `${prefix}${key}: ${JSON.stringify(value)}\n`
      }
    }

    return output
  }

  /**
   * Write generated content to file
   */
  async write(session: ParsedSession, outputPath: string): Promise<void> {
    const fullPath = resolve(outputPath)

    // Ensure directory exists
    const dir = dirname(fullPath)
    await mkdir(dir, { recursive: true })

    // Generate content
    const content = this.options.includeFrontMatter ? this.generateWithFrontMatter(session) : this.generate(session)

    await writeFile(fullPath, content, 'utf-8')
  }
}

/**
 * Convenience function to generate and write md file
 */
export async function generateMD(
  session: ParsedSession,
  constraint: FormatConstraint,
  outputPath: string,
  options?: GeneratorOptions
): Promise<void> {
  const generator = new MDGenerator(constraint, options)
  await generator.write(session, outputPath)
}
