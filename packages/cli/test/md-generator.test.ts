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
  events: [],
}

describe('MDGenerator', () => {
  it('should generate content without front matter', () => {
    const generator = new MDGenerator(DEFAULT_CONSTRAINT, { includeFrontMatter: false })
    expect(generator.generate(SAMPLE_SESSION)).toMatchSnapshot()
  })

  it('should generate content with front matter', () => {
    const generator = new MDGenerator(DEFAULT_CONSTRAINT)
    expect(generator.generateWithFrontMatter(SAMPLE_SESSION)).toMatchSnapshot()
  })

  it('should exclude timestamps when disabled', () => {
    const generator = new MDGenerator(DEFAULT_CONSTRAINT, {
      includeFrontMatter: false,
      includeTimestamps: false,
    })
    expect(generator.generate(SAMPLE_SESSION)).toMatchSnapshot()
  })

  it('should include total tokens in front matter', () => {
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
    expect(generator.generateWithFrontMatter(sessionWithUsage)).toMatchSnapshot()
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
    expect(generator.generate(sessionWithThinking)).toMatchSnapshot()
  })

  it('should render error tool result', () => {
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
    expect(generator.generate(sessionWithError)).toMatchSnapshot()
  })

  it('should handle empty messages', () => {
    const sessionEmpty: ParsedSession = {
      ...SAMPLE_SESSION,
      messages: [],
    }

    const generator = new MDGenerator(DEFAULT_CONSTRAINT, { includeFrontMatter: false })
    expect(generator.generate(sessionEmpty)).toMatchSnapshot()
  })

  it('should interleave non-message events chronologically', () => {
    const sessionWithEvents: ParsedSession = {
      ...SAMPLE_SESSION,
      messages: [
        {
          id: 'msg1',
          timestamp: '2026-02-17T23:02:40.000Z',
          role: 'user',
          content: 'Hello',
        },
      ] as ParsedMessage[],
      events: [
        {
          type: 'thinking_level_change',
          id: 'evt1',
          timestamp: '2026-02-17T23:02:39.000Z',
          thinkingLevel: 'off',
        },
      ],
    }

    const generator = new MDGenerator(DEFAULT_CONSTRAINT, { includeFrontMatter: false })
    expect(generator.generate(sessionWithEvents)).toMatchSnapshot()
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
      expect(content).toMatchSnapshot()
    } finally {
      await rm(outPath, { force: true })
    }
  })
})

describe('sample-session-2.jsonl full pipeline', () => {
  it('should generate markdown from sample-session-2.jsonl', async () => {
    const { parseSession } = await import('../src/index')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { readFile, rm } = await import('node:fs/promises')

    const session = await parseSession(`${import.meta.dir}/fixtures/sample-session-2.jsonl`)
    const outPath = join(tmpdir(), `md-generator-sample-2-${Date.now()}.md`)
    try {
      await generateMD(session, DEFAULT_CONSTRAINT, outPath)
      const content = await readFile(outPath, 'utf-8')
      expect(content).toMatchSnapshot()
    } finally {
      await rm(outPath, { force: true })
    }
  })
})
