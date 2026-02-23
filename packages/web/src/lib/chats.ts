/**
 * Share chat utilities
 */

import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

export interface ChatMetadata {
  platform: string
  topic: string
  date: string
  messageCount: number
  visibility: 'public' | 'private'
  description: string
}

export interface ChatData extends ChatMetadata {
  slug: string
}

/**
 * Fetch all share chats from chats/
 */
export function getAllChats(): ChatData[] {
  const workdir = process.env.CHATS_SHARE_WORKDIR ?? path.join(process.cwd(), '..', '..')
  const dataDir = path.join(workdir, 'chats')
  if (!fs.existsSync(dataDir)) {
    return []
  }

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.md'))
  return files.map(file => {
    const raw = fs.readFileSync(path.join(dataDir, file), 'utf-8')
    const slug = file.replace('.md', '')
    const { data } = matter(raw)

    return {
      slug,
      platform: data.platform || '',
      topic: data.topic || '',
      date: data.date ? String(data.date) : '',
      messageCount: parseInt(data.message_count, 10) || 0,
      visibility: (data.visibility as 'public' | 'private') || 'public',
      description: data.description || '',
    }
  })
}

/**
 * Filter to only return public chats
 */
export function getPublicChats(): ChatData[] {
  return getAllChats().filter(chat => chat.visibility !== 'private')
}

/**
 * Get chats sorted by date (newest first)
 */
export function getChatsSortedByDate(chats: ChatData[]): ChatData[] {
  return [...chats].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })
}
