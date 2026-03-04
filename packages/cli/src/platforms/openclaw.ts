/**
 * OpenClaw platform parser
 * Handles Openclaw JSONL session.log files
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Platform } from '../platform.js'
import type {
  ParsedMessage,
  ParsedSession,
  ParserOptions,
  SessionEvent,
  SessionMeta,
  ToolResultDetails,
  ToolResultImage,
  Usage,
} from '../session-log-parser/index.js'

// OpenClaw-specific parsing-input types (JSONL schema)

export interface MessageContentBlock {
  type: 'text' | 'thinking' | 'toolCall' | 'image'
  text?: string
  thinking?: string
  thinkingSignature?: string
  id?: string
  name?: string
  arguments?: Record<string, unknown>
  source?: {
    type: 'base64'
    media_type: string
    data: string
  }
  data?: string
  mimeType?: string
}

export interface ToolResultContent {
  type: 'text'
  text: string
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

const DEFAULT_OPTIONS: ParserOptions = {
  includeThinking: true,
  includeUsage: true,
}

export class OpenClawParser implements Platform {
  readonly name = 'openclaw'
  private options: ParserOptions

  constructor(options: ParserOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Parse a session.log JSONL file
   */
  async parseFile(filePath: string): Promise<ParsedSession> {
    const content = await readFile(resolve(filePath), 'utf-8')
    return this.parse(content)
  }

  /**
   * Parse JSONL content directly
   */
  parse(content: string): ParsedSession {
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
   * @deprecated Use parse() instead
   */
  parseContent(content: string): ParsedSession {
    return this.parse(content)
  }

  /**
   * Build structured session from events
   */
  private buildSession(events: SessionEvent[]): ParsedSession {
    const sessionEvent = events.find(e => e.type === 'session') as unknown as SessionMeta | undefined
    const modelChanges = events.filter(e => e.type === 'model_change')
    const nonMessageEvents = events.filter(e => e.type !== 'message')
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

    // Convert Openclaw session role ('user'/'assistant') to chats-share role ('human'/'agent')
    const roleMap: Record<'user' | 'assistant' | 'toolResult', 'human' | 'agent' | 'toolResult'> = {
      user: 'human',
      assistant: 'agent',
      toolResult: 'toolResult',
    }
    const convertedRole = roleMap[message.role]

    const parsed: ParsedMessage = {
      id: event.id,
      parentId: event.parentId || undefined,
      timestamp: event.timestamp,
      role: convertedRole,
      content: '',
      model: message.model,
    }

    // Extract content blocks
    const images: ToolResultImage[] = []
    for (const block of message.content) {
      if (block.type === 'text' && block.text) {
        let text = block.text
        // Clean up Discord/Telegram metadata prefix from user messages
        if (message.role === 'user') {
          text = this.cleanExternalChannelMessage(text)
        }
        parsed.content += text
      } else if (block.type === 'thinking' && this.options.includeThinking) {
        parsed.thinking = block.thinking
      } else if (block.type === 'toolCall') {
        parsed.toolCall = {
          id: block.id || '',
          name: block.name || '',
          arguments: block.arguments || {},
        }
      } else if (block.type === 'image') {
        // Extract image data from any message role (user, assistant, toolResult)
        const mediaType = block.source?.media_type || 'image/png'
        const imageData = block.source?.data || block.data || ''
        if (imageData) {
          images.push({
            type: 'image',
            data: imageData,
            mimeType: mediaType,
          })
        } else {
          // Fallback: just add text reference if no data
          parsed.content += `[${mediaType} attachment]`
        }
      }
    }

    // Store images if any were found
    if (images.length > 0) {
      parsed.images = images
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

  /**
   * Clean up Discord/Telegram/etc metadata prefix from user messages
   * Example: "[Discord Guild #channel ...] user: message content [from: user]"
   * becomes: "message content"
   */
  private cleanExternalChannelMessage(text: string): string {
    // Pattern for Discord messages: [Discord ...] user (username): message [from: ...]
    // Pattern for Telegram messages: user (username): message
    // Remove the channel metadata prefix and trailing metadata like [message_id: xxx] or [from: xxx]
    // Handle multi-line messages with [message_id: xxx] on second line

    // First, try to match and remove Discord-style prefix (may have trailing metadata on new line)
    // Example: [Discord Guild #lambda-test channel id:1234567890123456789 Wed 2026-02-18 07:02 GMT+8] yelo (xxx): message [from: yelo (1234567890123456789)]
    // with optional [message_id: xxx] on second line
    const discordMatch = text.match(
      /^\[Discord[^\]]*\]\s*[^\s:]+(?:\s*\([^)]+\))?:\s*(.+?)(?:\s*\[(?:from|message_id):[^\]]+\])?(?:\n\[(?:from|message_id):[^\]]+\])?\s*$/s
    )
    if (discordMatch) {
      return discordMatch[1].trim()
    }

    // Try to remove trailing [from: xxx] or [message_id: xxx] suffix (single or multi-line)
    // Matches "content [from: xxx]" or "content [from: xxx]\n[message_id: xxx]"
    const suffixMatch = text.match(/^(.+?)\s*\[(?:from|message_id):[^\]]+\](?:\n\[(?:from|message_id):[^\]]+\])?\s*$/s)
    if (suffixMatch) {
      return suffixMatch[1].trim()
    }

    // Try Telegram-style prefix: user (username): message
    const telegramMatch = text.match(/^[^\s:]+(?:\s*\([^)]+\))?:\s*(.+)$/s)
    if (telegramMatch) {
      return telegramMatch[1].trim()
    }

    // Handle Discord untrusted metadata format:
    // - "Conversation info (untrusted metadata):\n```json\n{...}\n```"
    // - "Sender (untrusted metadata):\n```json\n{...}\n```"
    // - "Chat history since last reply (untrusted, for context):\n```json\n[...]\n```"
    // - "<@1234567890123456789>" mention at the end
    // - "[media attached: /path/to/file.png (image/png) | /path/to/file.png]" debug info
    // - "<media:image> (1 image)" Discord media marker
    // - "To send an image back, prefer..." instruction text

    // Note: In JSON strings, backticks are escaped as \` so we need to handle both cases
    let cleaned = text

    // Remove media attached line (e.g., "[media attached: /home/user/.openclaw/media/inbound/xxx.png (image/png) | /home/user/.openclaw/media/inbound/xxx.png]")
    cleaned = cleaned.replace(/^\[media attached:[^\]]+\]\n?/g, '')

    // Remove Discord image instruction lines
    cleaned = cleaned.replace(/^To send an image back, prefer the message tool.*$/gm, '')

    // Remove media:image marker (e.g., "<media:image> (1 image)")
    cleaned = cleaned.replace(/^<media:[^>]+>\s*\((\d+)(\s+image)?\)\s*$/gm, '')

    // Remove Conversation info (untrusted metadata) block with JSON
    // In the parsed JSON string, the backticks are regular ``` (not escaped)
    // Note: May have leading \n from previous block removal, so use \n? at start
    cleaned = cleaned.replace(/^\n?Conversation info \(untrusted metadata\):\n```json\n[\s\S]*?```\n?/gm, '')

    // Remove Sender (untrusted metadata) block with JSON
    cleaned = cleaned.replace(/^\n?Sender \(untrusted metadata\):\n```json\n[\s\S]*?```\n?/gm, '')

    // Remove Chat history since last reply block with JSON
    // Extract the "body" field from the JSON as actual message content
    const chatHistoryMatch = cleaned.match(
      /^\n?Chat history since last reply \(untrusted, for context\):\n```json\n([\s\S]*?)```\n?/m
    )
    let chatHistoryBody = ''
    if (chatHistoryMatch?.[1]) {
      try {
        const chatHistoryJson = JSON.parse(chatHistoryMatch?.[1] || '')
        // Find the last message's body (most recent)
        if (Array.isArray(chatHistoryJson) && chatHistoryJson.length > 0) {
          const lastEntry = chatHistoryJson[chatHistoryJson.length - 1]
          if (lastEntry?.body) {
            chatHistoryBody = lastEntry.body
          }
        }
      } catch (_e) {
        // JSON parse error, ignore
      }
    }
    cleaned = cleaned.replace(
      /^\n?Chat history since last reply \(untrusted, for context\):\n```json\n[\s\S]*?```\n?/gm,
      ''
    )
    // If we extracted body content, prepend it to the cleaned text
    if (chatHistoryBody) {
      cleaned = `${chatHistoryBody}
${cleaned}`
    }

    // Remove Discord mention tags like <@1234567890123456782> from the end
    // Keep them if they're the only content
    cleaned = cleaned.replace(/\n?<@\d+>\n?$/gm, '')

    // Remove leading/trailing whitespace and empty lines
    cleaned = cleaned.trim()

    // If cleaned is empty but original had content, it means the message was only metadata
    // In that case, try to keep just the mention if present
    if (cleaned.length === 0) {
      // Try to extract mention from original text
      const mentionMatch = text.match(/<@\d+>/)
      if (mentionMatch) {
        return mentionMatch[0]
      }
      return ''
    }
    return cleaned
  }
}

/** @deprecated Use OpenClawParser instead */
export class LogParser {
  private _parser: OpenClawParser

  constructor(options: ParserOptions = {}) {
    this._parser = new OpenClawParser(options)
  }

  async parse(filePath: string): Promise<ParsedSession> {
    return this._parser.parseFile(filePath)
  }

  parseContent(content: string): ParsedSession {
    return this._parser.parse(content)
  }
}

/**
 * Convenience function to parse a session file
 */
export async function parseSession(filePath: string, options?: ParserOptions): Promise<ParsedSession> {
  const parser = new OpenClawParser(options)
  return parser.parseFile(filePath)
}
