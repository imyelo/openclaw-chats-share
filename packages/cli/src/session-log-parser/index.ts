/**
 * Session Log Parser — platform-agnostic types and re-exports
 */

// Platform-agnostic output types

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

export interface ToolResultImage {
  type: 'image'
  data: string
  mimeType: string
}

export interface ToolResultDetails {
  diff?: string
  firstChangedLine?: number
  [key: string]: unknown
}

export interface ParsedMessage {
  id: string
  parentId?: string
  timestamp: string
  role: 'human' | 'agent' | 'toolResult'
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
  images?: ToolResultImage[]
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

// Re-export OpenClaw platform parser for backward compatibility
export { LogParser, OpenClawParser, parseSession } from '../platforms/openclaw.js'
