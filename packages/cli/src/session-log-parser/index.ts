/**
 * Session Log Parser
 * Parses JSONL session files from Openclaw
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Event types from session.log
export interface SessionEvent {
  type: 'session' | 'model_change' | 'thinking_level_change' | 'custom' | 'message' | 'compaction'
  id: string
  parentId?: string | null
  timestamp: string
  [key: string]: unknown
}

export interface SessionMeta {
  type: 'session'
  version: number
  id: string
  timestamp: string
  cwd: string
}

export interface MessageContentBlock {
  type: 'text' | 'thinking' | 'toolCall'
  text?: string
  thinking?: string
  thinkingSignature?: string
  id?: string
  name?: string
  arguments?: Record<string, unknown>
}

export interface Usage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  cost: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    total: number
  }
}

export interface ToolResultContent {
  type: 'text'
  text: string
}

export interface ToolResultDetails {
  diff?: string
  firstChangedLine?: number
  [key: string]: unknown
}

export interface MessageEvent {
  type: 'message'
  id: string
  parentId?: string | null
  timestamp: string
  message: {
    role: 'user' | 'assistant' | 'toolResult'
    content: MessageContentBlock[]
    api?: string
    provider?: string
    model?: string
    usage?: Usage
    stopReason?: string
    toolCallId?: string
    toolName?: string
    isError?: boolean
    details?: ToolResultDetails
  }
}

export interface ParsedMessage {
  id: string
  parentId?: string
  timestamp: string
  role: 'user' | 'assistant' | 'toolResult'
  content: string
  thinking?: string
  model?: string
  toolCall?: {
    id: string
    name: string
    arguments: Record<string, unknown>
  }
  toolResult?: {
    toolCallId: string
    toolName: string
    content: string
    isError: boolean
    details?: ToolResultDetails
  }
  usage?: Usage
  stopReason?: string
}

export interface ParsedSession {
  meta: SessionMeta
  messages: ParsedMessage[]
  modelChanges: SessionEvent[]
  /** All non-session, non-message events in chronological order */
  events: SessionEvent[]
}

export interface ParserOptions {
  includeThinking?: boolean
  includeUsage?: boolean
}

const DEFAULT_OPTIONS: ParserOptions = {
  includeThinking: true,
  includeUsage: true,
}

export class LogParser {
  private options: ParserOptions

  constructor(options: ParserOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Parse a session.log JSONL file
   */
  async parse(filePath: string): Promise<ParsedSession> {
    const content = await readFile(resolve(filePath), 'utf-8')
    return this.parseContent(content)
  }

  /**
   * Parse JSONL content directly
   */
  parseContent(content: string): ParsedSession {
    const lines = content.trim().split('\n')
    const events: SessionEvent[] = []

    for (const line of lines) {
      if (!line.trim()) {
        continue
      }
      try {
        const event = JSON.parse(line) as SessionEvent
        events.push(event)
      } catch (error) {
        console.warn('Failed to parse line:', line.slice(0, 100), error)
      }
    }

    return this.buildSession(events)
  }

  /**
   * Build structured session from events
   */
  private buildSession(events: SessionEvent[]): ParsedSession {
    const sessionEvent = events.find(e => e.type === 'session') as unknown as SessionMeta | undefined
    const modelChanges = events.filter(e => e.type === 'model_change')
    const nonMessageEvents = events.filter(e => e.type !== 'session' && e.type !== 'message')
    const messages: ParsedMessage[] = []

    for (const event of events) {
      if (event.type === 'message') {
        const parsed = this.parseMessageEvent(event as unknown as MessageEvent)
        if (parsed) {
          messages.push(parsed)
        }
      }
    }

    return {
      meta: sessionEvent || {
        type: 'session',
        version: 0,
        id: 'unknown',
        timestamp: new Date().toISOString(),
        cwd: '',
      },
      messages,
      modelChanges,
      events: nonMessageEvents,
    }
  }

  /**
   * Parse a single message event
   */
  private parseMessageEvent(event: MessageEvent): ParsedMessage | null {
    const { message } = event
    if (!message) {
      return null
    }

    const parsed: ParsedMessage = {
      id: event.id,
      parentId: event.parentId || undefined,
      timestamp: event.timestamp,
      role: message.role,
      content: '',
      model: message.model,
    }

    // Extract content blocks
    for (const block of message.content) {
      if (block.type === 'text' && block.text) {
        parsed.content += block.text
      } else if (block.type === 'thinking' && this.options.includeThinking) {
        parsed.thinking = block.thinking
      } else if (block.type === 'toolCall') {
        parsed.toolCall = {
          id: block.id || '',
          name: block.name || '',
          arguments: block.arguments || {},
        }
      }
    }

    // Handle toolResult
    if (message.role === 'toolResult') {
      parsed.toolResult = {
        toolCallId: message.toolCallId || '',
        toolName: message.toolName || '',
        content: parsed.content,
        isError: message.isError || false,
        details: message.details,
      }
    }

    // Include usage if available
    if (this.options.includeUsage && message.usage) {
      parsed.usage = message.usage
      parsed.stopReason = message.stopReason
    }

    return parsed
  }
}

/**
 * Convenience function to parse a session file
 */
export async function parseSession(filePath: string, options?: ParserOptions): Promise<ParsedSession> {
  const parser = new LogParser(options)
  return parser.parse(filePath)
}
