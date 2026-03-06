#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { cpSync, mkdirSync } from 'node:fs'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { values, positionals } = parseArgs({
  options: {
    dir: { type: 'string', short: 'd' },
  },
  allowPositionals: true,
})

const [projectName] = positionals
const { dir } = values

// --dir overrides the output location; it may be absolute or relative to cwd.
// When omitted, fall back to <cwd>/<projectName|my-chats-project>.
const targetDir = dir
  ? (isAbsolute(dir) ? dir : join(process.cwd(), dir))
  : join(process.cwd(), projectName || 'my-chats-project')

// Human-readable label used in the commit message and the cd hint.
const displayName = projectName || basename(targetDir)

console.log(`Creating project in: ${targetDir}`)

mkdirSync(targetDir, { recursive: true })
mkdirSync(join(targetDir, 'chats'), { recursive: true })
mkdirSync(join(targetDir, 'public'), { recursive: true })
mkdirSync(join(targetDir, '.vscode'), { recursive: true })

const tpl = (...parts) => join(dirname(fileURLToPath(import.meta.url)), '../templates', ...parts)
const out = (...parts) => join(targetDir, ...parts)

// Core config
cpSync(tpl('package.json'), out('package.json'))
cpSync(tpl('astro.config.mjs'), out('astro.config.mjs'))
cpSync(tpl('chats-share.toml'), out('chats-share.toml'))
cpSync(tpl('chats/.gitkeep'), out('chats/.gitkeep'))
cpSync(tpl('public/.nojekyll'), out('public/.nojekyll'))

// Lint
cpSync(tpl('_biome.json'), out('biome.json'))

// Editor / VCS
cpSync(tpl('gitignore'), out('.gitignore'))
cpSync(tpl('.editorconfig'), out('.editorconfig'))
cpSync(tpl('.vscode/extensions.json'), out('.vscode/extensions.json'))

// Docs
cpSync(tpl('README.md'), out('README.md'))

// GitHub workflow
const ghWorkflowDir = out('.github/workflows')
mkdirSync(ghWorkflowDir, { recursive: true })
cpSync(tpl('.github/workflows/deploy.yml'), out('.github/workflows/deploy.yml'))

// Initialize a fresh git repo so the project is not nested under any parent .git
try {
  const opts = { cwd: targetDir, stdio: 'ignore' }
  execSync('git init', opts)
  try {
    execSync('git add .', opts)
    execSync(`git commit -m "feat: scaffold ${displayName}"`, opts)
  } catch {
    console.warn('Warning: git init succeeded but initial commit failed (git identity may not be configured).')
    console.warn('Run: git add . && git commit -m "feat: scaffold" inside the project directory.')
  }
} catch {
  console.warn('Warning: git not found. Skipping git init.')
}

console.log('Project created!')
console.log(`cd ${targetDir}`)
console.log('bun install')
console.log('bun run dev')
