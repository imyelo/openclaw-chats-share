#!/usr/bin/env node
import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { positionals } = parseArgs({
  options: {
    dir: { type: 'string', short: 'd' },
  },
  allowPositionals: true,
})

const [projectName] = positionals
const targetDir = join(process.cwd(), projectName || 'my-chats-project')

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

console.log('Project created!')
console.log(`cd ${projectName || 'my-chats-project'}`)
console.log('bun install')
console.log('bun run dev')
