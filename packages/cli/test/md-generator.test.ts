import { describe, expect, it } from 'bun:test'
import type { ParsedMessage, ParsedSession } from '../src/index'
import { DEFAULT_CONSTRAINT, generateMD, MDGenerator } from '../src/index'

const SAMPLE_SESSION: ParsedSession = {
  meta: {
    type: 'session',
    version: 3,
    id: 'test-session-123',
    timestamp: '2026-02-17T23:02:38.146Z',
    cwd: '/home/test',
  },
  messages: [
    {
      id: 'msg1',
      timestamp: '2026-02-17T23:02:38.166Z',
      role: 'user',
      content: 'Hello, can you help me?',
    },
    {
      id: 'msg2',
      parentId: 'msg1',
      timestamp: '2026-02-17T23:02:52.044Z',
      role: 'assistant',
      content: 'Of course! How can I assist you today?',
    },
    {
      id: 'msg3',
      parentId: 'msg2',
      timestamp: '2026-02-17T23:02:59.000Z',
      role: 'assistant',
      content: 'Let me write that to a file.',
      toolCall: {
        id: 'call1',
        name: 'write',
        arguments: { file_path: '/test.md', content: 'test content' },
      },
    },
    {
      id: 'msg4',
      parentId: 'msg3',
      timestamp: '2026-02-17T23:03:00.000Z',
      role: 'toolResult',
      content: 'Successfully wrote 100 bytes to /test.md',
      toolResult: {
        toolCallId: 'call1',
        toolName: 'write',
        content: 'Successfully wrote 100 bytes to /test.md',
        isError: false,
      },
    },
  ] as ParsedMessage[],
  modelChanges: [],
}

describe('MDGenerator', () => {
  it('should generate basic markdown', () => {
    const generator = new MDGenerator(DEFAULT_CONSTRAINT, { includeFrontMatter: false })
    const output = generator.generate(SAMPLE_SESSION)

    expect(output).toContain('## Summary')
    expect(output).toContain('## Conversation')
  })

  it('should include front matter', () => {
    const generator = new MDGenerator(DEFAULT_CONSTRAINT)
    const output = generator.generateWithFrontMatter(SAMPLE_SESSION)

    expect(output).toContain('---')
    expect(output).toContain('title:')
    expect(output).toContain('sessionId:')
  })

  it('should extract summary', () => {
    const generator = new MDGenerator(DEFAULT_CONSTRAINT, { includeFrontMatter: false })
    const output = generator.generate(SAMPLE_SESSION)

    expect(output).toContain('Hello')
    expect(output).toContain('How can I assist')
  })

  it('should format messages correctly', () => {
    const generator = new MDGenerator(DEFAULT_CONSTRAINT, { includeFrontMatter: false })
    const output = generator.generate(SAMPLE_SESSION)

    expect(output).toContain('**user:**')
    expect(output).toContain('**assistant:**')
  })

  it('should include tool calls', () => {
    const generator = new MDGenerator(DEFAULT_CONSTRAINT, { includeFrontMatter: false })
    const output = generator.generate(SAMPLE_SESSION)

    expect(output).toContain('Tool: write')
    expect(output).toContain('/test.md')
  })

  it('should include tool results', () => {
    const generator = new MDGenerator(DEFAULT_CONSTRAINT, { includeFrontMatter: false })
    const output = generator.generate(SAMPLE_SESSION)

    expect(output).toContain('✅ Result:')
    expect(output).toContain('Successfully wrote')
  })

  it('should exclude timestamps when disabled', () => {
    const generator = new MDGenerator(DEFAULT_CONSTRAINT, {
      includeFrontMatter: false,
      includeTimestamps: false,
    })
    const output = generator.generate(SAMPLE_SESSION)

    expect(output).not.toContain('*[2026-02-17')
  })

  it('should calculate total tokens from messages', () => {
    const sessionWithUsage: ParsedSession = {
      ...SAMPLE_SESSION,
      messages: [
        {
          id: 'msg1',
          timestamp: '2026-02-17T23:02:38.166Z',
          role: 'user',
          content: 'Hello',
          usage: {
            input: 10,
            output: 20,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 30,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
        },
      ] as ParsedMessage[],
    }

    const generator = new MDGenerator(DEFAULT_CONSTRAINT)
    const output = generator.generateWithFrontMatter(sessionWithUsage)

    expect(output).toContain('totalTokens: 30')
  })
})

describe('MDGenerator - additional cases', () => {
  it('should render thinking blocks', () => {
    const sessionWithThinking: ParsedSession = {
      ...SAMPLE_SESSION,
      messages: [
        {
          id: 'msg1',
          timestamp: '2026-02-17T23:02:38.166Z',
          role: 'assistant',
          content: 'Final answer',
          thinking: 'Let me think about this...',
        },
      ] as ParsedMessage[],
    }

    const generator = new MDGenerator(DEFAULT_CONSTRAINT, { includeFrontMatter: false })
    const output = generator.generate(sessionWithThinking)

    expect(output).toContain('💭')
    expect(output).toContain('Let me think about this...')
    expect(output).toContain('Final answer')
  })

  it('should render error tool result with ❌', () => {
    const sessionWithError: ParsedSession = {
      ...SAMPLE_SESSION,
      messages: [
        {
          id: 'msg1',
          timestamp: '2026-02-17T23:02:38.166Z',
          role: 'toolResult',
          content: 'File not found',
          toolResult: {
            toolCallId: 'call1',
            toolName: 'read',
            content: 'File not found',
            isError: true,
          },
        },
      ] as ParsedMessage[],
    }

    const generator = new MDGenerator(DEFAULT_CONSTRAINT, { includeFrontMatter: false })
    const output = generator.generate(sessionWithError)

    expect(output).toContain('❌ Result:')
    expect(output).toContain('File not found')
  })

  it('should fall back to message count when messages have no user/assistant pair', () => {
    const sessionEmpty: ParsedSession = {
      ...SAMPLE_SESSION,
      messages: [],
    }

    const generator = new MDGenerator(DEFAULT_CONSTRAINT, { includeFrontMatter: false })
    const output = generator.generate(sessionEmpty)

    expect(output).toContain('0 messages')
  })
})

describe('generateMD convenience function', () => {
  it('should write markdown to disk', async () => {
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { readFile, rm } = await import('node:fs/promises')

    const outPath = join(tmpdir(), `md-generator-test-${Date.now()}.md`)
    try {
      await generateMD(SAMPLE_SESSION, DEFAULT_CONSTRAINT, outPath)
      const content = await readFile(outPath, 'utf-8')
      expect(content).toContain('---')
      expect(content).toContain('## Conversation')
    } finally {
      await rm(outPath, { force: true })
    }
  })
})
