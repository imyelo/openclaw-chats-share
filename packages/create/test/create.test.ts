import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { execSync } from 'node:child_process'
import { mkdirSync, realpathSync, rmSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CREATE_SCRIPT = join(import.meta.dir, '../bin/create.js')

async function getDirectorySnapshot(dir: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  async function walk(currentDir: string, relativePath = '') {
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === '.git') {
        continue
      }
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
    env: {
      ...process.env,
      // Provide a clean git identity and disable signing so git commit
      // works reliably in test subprocesses regardless of the host config.
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_AUTHOR_NAME: 'test',
      GIT_AUTHOR_EMAIL: 'test@test',
      GIT_COMMITTER_NAME: 'test',
      GIT_COMMITTER_EMAIL: 'test@test',
    },
  })
  const exitCode = await proc.exited
  const stderr = await new Response(proc.stderr).text()
  return { exitCode, stderr }
}

describe('create-openclaw-chats-share', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = join(tmpdir(), `create-test-${Date.now()}`)
    mkdirSync(tempDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should scaffold a named project with the correct files', async () => {
    const { exitCode } = await runCreate(tempDir, ['my-test-project'])
    expect(exitCode).toBe(0)
    const snapshot = await getDirectorySnapshot(join(tempDir, 'my-test-project'))
    expect(snapshot).toMatchSnapshot()
  })

  it('should initialize a git repo with an initial commit', async () => {
    const { stderr } = await runCreate(tempDir, ['my-test-project'])
    const projectDir = join(tempDir, 'my-test-project')
    // git init must have run
    const toplevel = execSync('git rev-parse --show-toplevel', { cwd: projectDir }).toString().trim()
    expect(realpathSync(toplevel)).toBe(realpathSync(projectDir))
    // commit must have succeeded — no warning in stderr
    expect(stderr).not.toContain('Warning:')
    const log = execSync('git log --oneline', { cwd: projectDir }).toString().trim()
    expect(log).toMatch(/feat: scaffold my-test-project/)
  })

  it('should create its own git repo even when run inside an existing git repo', async () => {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' })
    await runCreate(tempDir, ['my-test-project'])
    const projectDir = join(tempDir, 'my-test-project')
    // The project's own .git should point to itself, not the parent
    const toplevel = execSync('git rev-parse --show-toplevel', { cwd: projectDir }).toString().trim()
    expect(realpathSync(toplevel)).toBe(realpathSync(projectDir))
  })

  it('should use default project name when not specified', async () => {
    const { exitCode } = await runCreate(tempDir)
    expect(exitCode).toBe(0)
    const snapshot = await getDirectorySnapshot(join(tempDir, 'my-chats-project'))
    expect(snapshot).toMatchSnapshot()
  })

  describe('--dir flag', () => {
    it('should create project at a relative --dir path', async () => {
      const { exitCode } = await runCreate(tempDir, ['my-project', '--dir', 'custom-output'])
      expect(exitCode).toBe(0)
      const snapshot = await getDirectorySnapshot(join(tempDir, 'custom-output'))
      expect(snapshot).toMatchSnapshot()
    })

    it('should create project at an absolute --dir path', async () => {
      const absTarget = join(tempDir, 'abs-target')
      const { exitCode } = await runCreate(tempDir, ['my-project', '--dir', absTarget])
      expect(exitCode).toBe(0)
      const snapshot = await getDirectorySnapshot(absTarget)
      expect(snapshot).toMatchSnapshot()
    })

    it('should use projectName in commit message when --dir differs from projectName', async () => {
      const { exitCode, stderr } = await runCreate(tempDir, ['my-project', '--dir', 'custom-output'])
      const projectDir = join(tempDir, 'custom-output')
      expect(exitCode).toBe(0)
      expect(stderr).not.toContain('Warning:')
      const log = execSync('git log --oneline', { cwd: projectDir }).toString().trim()
      expect(log).toMatch(/feat: scaffold my-project/)
    })

    it('should use basename of --dir in commit message when no projectName given', async () => {
      const { exitCode, stderr } = await runCreate(tempDir, ['--dir', 'custom-output'])
      const projectDir = join(tempDir, 'custom-output')
      expect(exitCode).toBe(0)
      expect(stderr).not.toContain('Warning:')
      const log = execSync('git log --oneline', { cwd: projectDir }).toString().trim()
      expect(log).toMatch(/feat: scaffold custom-output/)
    })

    it('should not create a directory at the positional name when --dir is used', async () => {
      await runCreate(tempDir, ['my-project', '--dir', 'custom-output'])
      const { existsSync } = await import('node:fs')
      expect(existsSync(join(tempDir, 'my-project'))).toBe(false)
      expect(existsSync(join(tempDir, 'custom-output'))).toBe(true)
    })
  })
})
