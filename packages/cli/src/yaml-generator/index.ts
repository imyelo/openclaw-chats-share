/**
 * YAML File Generator
 * Generates YAML files from parsed session data using format constraints
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { stringify } from 'yaml'
import type { FormatConstraint } from '../format-constraint/index.js'
import type { ParsedMessage, ParsedSession, SessionEvent } from '../session-log-parser/index.js'

export interface GeneratorOptions {
  includeTimestamps?: boolean
  defaultShowProcess?: boolean
}

const DEFAULT_OPTIONS: GeneratorOptions = {
  includeTimestamps: true,
  defaultShowProcess: false,
}

function calculateTotalTokens(messages: ParsedMessage[]): number {
  return messages.reduce((sum, m) => sum + (m.usage?.totalTokens || 0), 0)
}

/**
 * YAML File Generator
 */
export class YAMLGenerator {
  private constraint: FormatConstraint
  private options: GeneratorOptions

  constructor(constraint: FormatConstraint, options: GeneratorOptions = {}) {
    this.constraint = constraint
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Generate YAML string from parsed session
   */
  generate(session: ParsedSession): string {
    const doc = this.buildDocument(session)
    return stringify(doc, { blockQuote: 'literal', indent: 2 })
  }

  private buildDocument(session: ParsedSession): Record<string, unknown> {
    const frontMatter = this.buildFrontMatter(session)
    const timeline = this.buildTimeline(session)
    return { ...frontMatter, timeline }
  }

  private buildFrontMatter(session: ParsedSession): Record<string, unknown> {
    const metadata: Record<string, unknown> = {}
    for (const field of this.constraint.metadata) {
      const value = this.getMetadataValue(field.key, session)
      if (value !== undefined) {
        metadata[field.key] = value
      }
    }
    return metadata
  }

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
      case 'defaultShowProcess':
        return this.options.defaultShowProcess ?? false
      // Manual fields - return undefined to allow manual addition
      case 'channel':
      case 'tags':
      case 'description':
        return undefined
      default:
        return undefined
    }
  }

  private buildTimeline(session: ParsedSession): unknown[] {
    // Build tool result lookup
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

    type TimelineItem =
      | { timestamp: string; kind: 'message'; data: ParsedMessage }
      | { timestamp: string; kind: 'event'; data: SessionEvent }

    const items: TimelineItem[] = [
      ...session.messages.map(m => ({ timestamp: m.timestamp, kind: 'message' as const, data: m })),
      ...session.events.map(e => ({ timestamp: e.timestamp, kind: 'event' as const, data: e })),
    ]
    items.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    const result: unknown[] = []
    for (const item of items) {
      if (item.kind === 'message') {
        // Skip toolResult messages that have a corresponding toolCall (embedded in the toolCall message)
        if (
          item.data.role === 'toolResult' &&
          item.data.toolResult?.toolCallId &&
          toolCallIds.has(item.data.toolResult.toolCallId)
        ) {
          continue
        }
        result.push(...this.buildMessageEntries(item.data, toolResultMap))
      } else {
        const entry = this.buildEventEntry(item.data)
        if (entry) {
          result.push(entry)
        }
      }
    }
    return result
  }

  private buildMessageEntries(msg: ParsedMessage, toolResultMap: Map<string, ParsedMessage>): Record<string, unknown>[] {
    const isToolResult = msg.role === 'toolResult'
    const role = isToolResult ? 'tool' : msg.role

    const base: Record<string, unknown> = {
      type: 'message',
      role,
      speaker: role,
      timestamp: msg.timestamp,
    }
    if (msg.model) { base.model = msg.model }

    const entries: Record<string, unknown>[] = []

    // Thinking block → separate entry
    if (msg.thinking) {
      entries.push({ ...base, process: [{ type: 'thinking', content: msg.thinking }] })
    }

    // Tool call → separate entry
    if (msg.toolCall) {
      const toolResultMsg = msg.toolCall.id ? toolResultMap.get(msg.toolCall.id) : undefined
      const tc: Record<string, unknown> = {
        type: 'tool_call',
        id: msg.toolCall.id,
        name: msg.toolCall.name,
        arguments: msg.toolCall.arguments,
      }
      if (toolResultMsg?.toolResult) {
        tc.result = {
          content: toolResultMsg.toolResult.content,
          isError: toolResultMsg.toolResult.isError,
        }
      }
      entries.push({ ...base, process: [tc] })
    }

    // Standalone toolResult without a matching toolCall → separate entry
    if (isToolResult && msg.toolResult && !msg.toolCall) {
      const tr = msg.toolResult
      entries.push({
        ...base,
        process: [
          {
            type: 'tool_call',
            id: tr.toolCallId,
            name: tr.toolName,
            arguments: {},
            result: { content: tr.content, isError: tr.isError },
          },
        ],
      })
    }

    // Text content → separate entry
    if (msg.content) {
      entries.push({ ...base, content: msg.content })
    }

    // Images — attach to last entry or standalone
    if (msg.images && msg.images.length > 0) {
      const imgData = msg.images.map(img => ({ mimeType: img.mimeType, data: img.data }))
      if (entries.length > 0) {
        entries[entries.length - 1].images = imgData
      } else {
        entries.push({ ...base, images: imgData })
      }
    }

    // Fallback: always emit at least one entry
    if (entries.length === 0) {
      entries.push({ ...base })
    }

    return entries
  }

  private buildEventEntry(event: SessionEvent): Record<string, unknown> | null {
    const e = event as Record<string, unknown>
    const base = { type: event.type, timestamp: event.timestamp }

    switch (event.type) {
      case 'session':
        return { ...base, cwd: e.cwd || '' }
      case 'model_change':
        return { ...base, model: String(e.modelId || ''), provider: String(e.provider || '') }
      case 'thinking_level_change':
        return { ...base, level: String(e.thinkingLevel || '') }
      case 'compaction':
        return { ...base, tokensBefore: e.tokensBefore ?? 0 }
      case 'custom': {
        const customType = String(e.customType || 'custom')
        const data = e.data as Record<string, unknown> | undefined
        const entry: Record<string, unknown> = { ...base, customType }
        if (customType === 'model-snapshot' && data) {
          entry.model = String(data.modelId || '')
          entry.provider = String(data.provider || '')
        }
        return entry
      }
      default:
        return null
    }
  }

  /**
   * Write generated YAML to file
   */
  async write(session: ParsedSession, outputPath: string): Promise<void> {
    const fullPath = resolve(outputPath)
    const dir = dirname(fullPath)
    await mkdir(dir, { recursive: true })
    const content = this.generate(session)
    await writeFile(fullPath, content, 'utf-8')
  }
}

/**
 * Convenience function to generate and write YAML file
 */
export async function generateYAML(
  session: ParsedSession,
  constraint: FormatConstraint,
  outputPath: string,
  options?: GeneratorOptions
): Promise<void> {
  const generator = new YAMLGenerator(constraint, options)
  await generator.write(session, outputPath)
}
