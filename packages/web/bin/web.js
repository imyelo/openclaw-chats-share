#!/usr/bin/env bun
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageDir = dirname(__dirname)
const astroBin = join(process.cwd(), 'node_modules/.bin/astro')

const { positionals } = parseArgs({
  options: {},
  positionals: ['command'],
  allowPositionals: true,
})

const [command] = positionals

const commands = {
  dev: [astroBin, 'dev'],
  build: [astroBin, 'build'],
  preview: [astroBin, 'preview'],
}

if (!commands[command]) {
  console.log('Commands: dev, build, preview')
  process.exit(1)
}

const proc = spawn(commands[command][0], [commands[command][1]], {
  stdio: 'inherit',
  shell: true,
  cwd: packageDir,
  env: { ...process.env, CHATS_SHARE_WORKDIR: process.cwd() },
})

proc.on('exit', code => process.exit(code || 0))
