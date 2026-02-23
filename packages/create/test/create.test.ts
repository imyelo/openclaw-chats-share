import { describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CREATE_SCRIPT = join(import.meta.dir, '../bin/create.js')

async function getDirectorySnapshot(dir: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  async function walk(currentDir: string, relativePath = '') {
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
      const fullPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath, entryRelPath)
      } else {
        result[entryRelPath] = await readFile(fullPath, 'utf-8')
      }
    }
  }
  await walk(dir)
  return result
}

async function runCreate(cwd: string, args: string[] = []) {
  const proc = Bun.spawn(['bun', CREATE_SCRIPT, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const exitCode = await proc.exited
  return { exitCode }
}

describe('create-openclaw-chats-share', () => {
  it('should scaffold a named project with the correct files', async () => {
    const tempDir = join(tmpdir(), `create-test-${Date.now()}`)
    try {
      mkdirSync(tempDir, { recursive: true })
      const { exitCode } = await runCreate(tempDir, ['my-test-project'])
      expect(exitCode).toBe(0)
      const snapshot = await getDirectorySnapshot(join(tempDir, 'my-test-project'))
      expect(snapshot).toMatchSnapshot()
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should use default project name when not specified', async () => {
    const tempDir = join(tmpdir(), `create-test-${Date.now()}`)
    try {
      mkdirSync(tempDir, { recursive: true })
      const { exitCode } = await runCreate(tempDir)
      expect(exitCode).toBe(0)
      const snapshot = await getDirectorySnapshot(join(tempDir, 'my-chats-project'))
      expect(snapshot).toMatchSnapshot()
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
