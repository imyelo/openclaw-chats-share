/**
 * MD File Generator
 * Generates markdown files from parsed session data using format constraints
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { ContentSection, FormatConstraint } from '../format-constraint/index.js'
import type { ParsedMessage, ParsedSession } from '../session-log-parser/index.js'

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
 * Format a message for markdown output
 */
function formatMessage(msg: ParsedMessage, options: GeneratorOptions): string {
  const indent = ' '.repeat(options.indentSize || 2)
  let output = ''

  if (options.includeTimestamps) {
    const date = new Date(msg.timestamp).toLocaleString()
    output += `*[${date}]* `
  }

  const roleLabel = msg.role === 'toolResult' ? '🔧 Tool' : msg.role
  output += `**${roleLabel}:** `

  // Add thinking if present
  if (msg.thinking) {
    output += `\n\n${indent}> 💭 ${msg.thinking.replace(/\n/g, `\n${indent}> `)}`
  }

  // Add content
  output += msg.content

  // Add tool call info
  if (msg.toolCall) {
    output += `\n\n${indent}*Tool: ${msg.toolCall.name}*`
    if (msg.toolCall.arguments.file_path) {
      output += ` - ${msg.toolCall.arguments.file_path}`
    }
  }

  // Add tool result
  if (msg.toolResult) {
    const icon = msg.toolResult.isError ? '❌' : '✅'
    output += `\n\n${indent}${icon} Result: ${msg.toolResult.content}`
  }

  return output
}

/**
 * Extract summary from messages
 */
function extractSummary(messages: ParsedMessage[]): string {
  // Find first user message and first assistant response
  const firstUser = messages.find(m => m.role === 'user')
  const firstAssistant = messages.find(m => m.role === 'assistant')

  if (firstUser && firstAssistant) {
    const preview = firstAssistant.content.slice(0, 200)
    return `${firstUser.content.slice(0, 100)}... → ${preview}`
  }

  return `Conversation with ${messages.length} messages`
}

/**
 * Extract tool calls from messages
 */
function extractToolCalls(messages: ParsedMessage[]): string {
  const toolCalls = messages.filter(m => m.toolCall)
  if (toolCalls.length === 0) {
    return 'No tool calls'
  }

  return toolCalls
    .map(m => {
      const tc = m.toolCall
      if (!tc) {
        return ''
      }
      const args = JSON.stringify(tc.arguments).slice(0, 50)
      return `- \`${tc.name}\`(${args})`
    })
    .join('\n')
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
   * Generate markdown content from parsed session
   */
  generate(session: ParsedSession): string {
    const sections = this.buildSections(session)
    const output = sections.join('\n\n')
    return output
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
      default:
        return undefined
    }
  }

  /**
   * Build content sections
   */
  private buildSections(session: ParsedSession): string[] {
    const sections: string[] = []

    for (const section of this.constraint.sections) {
      const content = this.buildSection(section, session)
      if (content) {
        sections.push(`## ${section.title}\n\n${content}`)
      }
    }

    return sections
  }

  /**
   * Build a single section
   */
  private buildSection(section: ContentSection, session: ParsedSession): string {
    switch (section.contentKey) {
      case 'summary':
        return extractSummary(session.messages)
      case 'messages':
        return session.messages.map(m => formatMessage(m, this.options)).join('\n\n---\n\n')
      case 'toolCalls':
        return extractToolCalls(session.messages)
      default:
        return ''
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
