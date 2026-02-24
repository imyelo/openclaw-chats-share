#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { DEFAULT_CONSTRAINT } from '../dist/format-constraint/index.js'
import { MDGenerator } from '../dist/md-generator/index.js'
import { LogParser } from '../dist/session-log-parser/index.js'

const { values, positionals } = parseArgs({
  options: {
    output: { type: 'string', short: 'o' },
    constraint: { type: 'string', short: 'c' },
  },
  allowPositionals: true,
})

const [command, inputPath] = positionals

if (command === 'parse') {
  if (!inputPath) {
    console.error('Usage: openclaw-chats-share parse <session.log> [-o output.md]')
    process.exit(1)
  }

  const content = readFileSync(inputPath, 'utf-8')
  const parser = new LogParser()
  const session = parser.parseContent(content)

  const generator = new MDGenerator(DEFAULT_CONSTRAINT)
  const markdown = generator.generateWithFrontMatter(session)

  const outputPath = values.output || inputPath.replace('.jsonl', '.md')
  writeFileSync(outputPath, markdown)

  console.log(`Generated: ${outputPath}`)
} else {
  console.log('Commands: parse <session.log>')
  process.exit(1)
}
