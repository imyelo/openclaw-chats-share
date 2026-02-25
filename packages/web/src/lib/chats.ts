/**
 * Share chat utilities
 */

import fs from 'node:fs'
import path from 'node:path'
import { format } from 'date-fns'
import matter from 'gray-matter'
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
}

export interface ChatData extends ChatMetadata {
  slug: string
}

export interface TextSegment {
  kind: 'text'
  content: string
}

export interface DirectiveSegment {
  kind: 'directive'
  type: string
  collapsed: boolean
  icon: string
  label: string
  content: string
}

export type MessageSegment = TextSegment | DirectiveSegment

export interface ParsedMessageBlock {
  author: string
  timestamp: string
  segments: MessageSegment[]
}

export interface ChatWithContent extends ChatData {
  messageBlocks: ParsedMessageBlock[]
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
 * Split message blocks by --- separator, but ignore --- inside :::{...} fenced directive blocks
 */
export function splitMessageBlocks(content: string): string[] {
  const blocks: string[] = []
  let current = ''
  let inFencedBlock = false

  const lines = content.split('\n')

  for (const line of lines) {
    // Check for fenced directive start: :::{...}
    if (!inFencedBlock && line.match(/^:::\{.+\}$/)) {
      inFencedBlock = true
      current += (current ? '\n' : '') + line
      continue
    }

    // Check for fenced directive end: :::
    if (inFencedBlock && line === ':::') {
      inFencedBlock = false
      current += `\n${line}`
      continue
    }

    // Check for --- separator (only when not in fenced block)
    if (!inFencedBlock && line === '---') {
      if (current.trim()) {
        blocks.push(current)
      }
      current = ''
      continue
    }

    current += (current ? '\n' : '') + line
  }

  // Add remaining block
  if (current.trim()) {
    blocks.push(current)
  }

  // Remove first block (title/content before first ---)
  return blocks.slice(1)
}

/** Parses `key=value,key=value` attribute string from a :::{...} fence opener */
function parseDirectiveAttrs(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const pair of attrStr.split(',')) {
    const eq = pair.indexOf('=')
    if (eq !== -1) {
      attrs[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim()
    }
  }
  return attrs
}

/** Extracts icon and bold label from a directive header line like `🔧 **Tool Call**` */
function parseDirectiveHeader(line: string): { icon: string; label: string } {
  const m = line.match(/^(.*?)\*\*(.+?)\*\*/)
  if (!m) return { icon: '', label: line.trim() }
  return { icon: m[1].trim(), label: m[2].trim() }
}

/** Matches :::{attrs}\nbody\n::: — lazy body so it stops at the first closing ::: */
const DIRECTIVE_RE = /:::\{([^}]+)\}\n([\s\S]*?)\n:::/g

/**
 * Parse a raw message block string into a structured ParsedMessageBlock.
 * Returns null for blocks that lack a `**author** · timestamp` header
 * (e.g. standalone session/model-change events).
 */
function parseMessageBlock(raw: string): ParsedMessageBlock | null {
  const headerMatch = raw.match(/\*\*(.*?)\*\* · (.+)/)
  if (!headerMatch) return null

  const author = headerMatch[1]
  const timestamp = headerMatch[2].trim()
  const body = raw.slice(headerMatch.index! + headerMatch[0].length).trim()

  const segments: MessageSegment[] = []
  let lastIndex = 0

  for (const m of body.matchAll(new RegExp(DIRECTIVE_RE.source, 'g'))) {
    const preText = body.slice(lastIndex, m.index!).trim()
    if (preText) segments.push({ kind: 'text', content: preText })

    const attrs = parseDirectiveAttrs(m[1])
    const type = attrs.type ?? m[1]
    // collapsed defaults false; only explicitly `true` closes by default
    const collapsed = attrs.collapsed === 'true'

    const directiveBody = m[2]
    const firstNl = directiveBody.indexOf('\n')
    const headerLine = firstNl === -1 ? directiveBody : directiveBody.slice(0, firstNl)
    const rawContent = firstNl === -1 ? '' : directiveBody.slice(firstNl + 1).trim()
    // Strip the leading *** or --- separator the md-generator inserts between label and body
    const content = rawContent.replace(/^[*-]{3,}\n?/, '')

    const { icon, label: rawLabel } = parseDirectiveHeader(headerLine)
    // Fallback: use type as label if the header line carried no bold text
    const label = rawLabel || type

    segments.push({ kind: 'directive', type, collapsed, icon, label, content })
    lastIndex = m.index! + m[0].length
  }

  const remainingText = body.slice(lastIndex).trim()
  if (remainingText) segments.push({ kind: 'text', content: remainingText })

  return { author, timestamp, segments }
}

/**
 * Fetch all share chats from chats/, including parsed message blocks
 */
export async function getAllChatsWithContent(): Promise<ChatWithContent[]> {
  const dataDir = await getDataDir()
  if (!fs.existsSync(dataDir)) {
    return []
  }

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.md'))
  return files.map(file => {
    const raw = fs.readFileSync(path.join(dataDir, file), 'utf-8')
    const slug = file.replace('.md', '')
    const { data, content } = matter(raw)

    return {
      slug,
      title: data.title || '',
      date: data.date ? format(new Date(data.date), 'yyyy-MM-dd') : '',
      sessionId: data.sessionId || '',
      channel: data.channel || '',
      model: data.model || '',
      totalMessages: parseInt(String(data.totalMessages), 10) || 0,
      totalTokens: parseInt(String(data.totalTokens), 10) || 0,
      tags: Array.isArray(data.tags) ? data.tags : [],
      visibility: (data.visibility as 'public' | 'private') || 'private',
      description: data.description || '',
      participants:
        data.participants && typeof data.participants === 'object'
          ? (data.participants as Record<string, { role: 'human' | 'agent'; model?: string }>)
          : undefined,
      messageBlocks: splitMessageBlocks(content).flatMap(block => {
        const parsed = parseMessageBlock(block)
        return parsed ? [parsed] : []
      }),
    }
  })
}

/**
 * Fetch all share chats from chats/
 */
export async function getAllChats(): Promise<ChatData[]> {
  return (await getAllChatsWithContent()).map(({ messageBlocks: _, ...chat }) => chat)
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
