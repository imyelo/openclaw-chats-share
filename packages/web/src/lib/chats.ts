/**
 * Share chat utilities
 */

import fs from 'node:fs'
import path from 'node:path'
import { format } from 'date-fns'
import { parse as parseYaml } from 'yaml'
import { getProjectConfig, getWorkingDir } from './config.js'

export interface ChatMetadata {
  title: string
  date: string
  sessionId: string
  channel: string
  model: string
  totalMessages: number
  totalTokens: number
  tags: string[]
  visibility: 'public' | 'private'
  description: string
  participants?: Record<string, { role: 'human' | 'agent'; model?: string }>
  defaultShowProcess?: boolean
}

export interface ChatData extends ChatMetadata {
  slug: string
}

export interface ChatToolCall {
  id: string
  name: string
  title?: string
  collapsed?: boolean
  arguments: Record<string, unknown>
  result?: { content: string; isError: boolean }
}

export interface ChatImage {
  mimeType: string
  data: string
}

export interface ChatMessage {
  type: 'message'
  role: 'user' | 'assistant' | 'tool'
  speaker: string
  timestamp: string
  model?: string
  thinking?: string
  content?: string
  toolCalls?: ChatToolCall[]
  images?: ChatImage[]
}

export interface ChatEvent {
  type: 'session' | 'model_change' | 'thinking_level_change' | 'custom' | 'compaction'
  timestamp: string
  [key: string]: unknown
}

export type ChatTimelineItem = ChatMessage | ChatEvent

export interface ChatWithContent extends ChatData {
  timeline: ChatTimelineItem[]
}

async function getDataDir(): Promise<string> {
  const workdir = getWorkingDir()
  const config = await getProjectConfig()
  if (config.chats_dir) {
    return path.resolve(workdir, config.chats_dir)
  }
  return path.join(workdir, 'chats')
}

/**
 * Fetch all share chats from chats/, including parsed timeline
 */
export async function getAllChatsWithContent(): Promise<ChatWithContent[]> {
  const dataDir = await getDataDir()
  if (!fs.existsSync(dataDir)) {
    return []
  }

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.yaml'))
  return files.map(file => {
    const raw = fs.readFileSync(path.join(dataDir, file), 'utf-8')
    const slug = file.replace('.yaml', '')
    const data = parseYaml(raw) as Record<string, unknown>

    return {
      slug,
      title: String(data.title || ''),
      date: data.date ? format(new Date(String(data.date)), 'yyyy-MM-dd') : '',
      sessionId: String(data.sessionId || ''),
      channel: String(data.channel || ''),
      model: String(data.model || ''),
      totalMessages: parseInt(String(data.totalMessages ?? '0'), 10) || 0,
      totalTokens: parseInt(String(data.totalTokens ?? '0'), 10) || 0,
      tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
      visibility: (data.visibility as 'public' | 'private') || 'private',
      description: String(data.description || ''),
      participants:
        data.participants && typeof data.participants === 'object'
          ? (data.participants as Record<string, { role: 'human' | 'agent'; model?: string }>)
          : undefined,
      defaultShowProcess: Boolean(data.defaultShowProcess),
      timeline: Array.isArray(data.timeline) ? (data.timeline as ChatTimelineItem[]) : [],
    }
  })
}

/**
 * Fetch all share chats from chats/
 */
export async function getAllChats(): Promise<ChatData[]> {
  return (await getAllChatsWithContent()).map(({ timeline: _, ...chat }) => chat)
}

/**
 * Filter to only return public chats
 */
export async function getPublicChats(): Promise<ChatData[]> {
  return (await getAllChats()).filter(chat => chat.visibility !== 'private')
}

/**
 * Get chats sorted by date (newest first)
 */
export function getChatsSortedByDate(chats: ChatData[]): ChatData[] {
  return [...chats].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })
}
