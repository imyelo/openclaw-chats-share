import { describe, expect, it } from 'bun:test'
import { DEFAULT_CONSTRAINT, YAMLGenerator } from '../src/index'
import type { ParsedSession } from '../src/index'

const mockSession: ParsedSession = {
  meta: {
    type: 'session',
    version: 1,
    id: 'test-123',
    timestamp: '2024-01-01T00:00:00Z',
    cwd: '/test',
  },
  messages: [
    {
      id: 'msg-1',
      timestamp: '2024-01-01T00:00:00Z',
      role: 'human',
      content: 'Hello',
    },
    {
      id: 'msg-2',
      timestamp: '2024-01-01T00:01:00Z',
      role: 'agent',
      content: 'Hi there',
      thinking: 'I should respond politely',
    },
    {
      id: 'msg-3',
      timestamp: '2024-01-01T00:02:00Z',
      role: 'agent',
      content: 'Running a command',
      toolCall: { id: 'tc-1', name: 'bash', arguments: { cmd: 'ls' } },
    },
  ],
  modelChanges: [],
  events: [],
}

describe('YAMLGenerator excludeProcess', () => {
  it('should exclude thinking when specified', () => {
    const generator = new YAMLGenerator(DEFAULT_CONSTRAINT, {
      excludeProcess: ['thinking'],
    })
    const yaml = generator.generate(mockSession)
    expect(yaml).not.toContain('thinking')
  })

  it('should exclude toolcalls when specified', () => {
    const generator = new YAMLGenerator(DEFAULT_CONSTRAINT, {
      excludeProcess: ['toolcalls'],
    })
    const yaml = generator.generate(mockSession)
    expect(yaml).not.toContain('tool_call')
  })

  it('should exclude all process when specified', () => {
    const generator = new YAMLGenerator(DEFAULT_CONSTRAINT, {
      excludeProcess: ['all'],
    })
    const yaml = generator.generate(mockSession)
    expect(yaml).not.toContain('thinking')
    expect(yaml).not.toContain('tool_call')
  })
})
