#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { DEFAULT_CONSTRAINT } from '../dist/format-constraint/index.js'
import { YAMLGenerator } from '../dist/yaml-generator/index.js'
import { LogParser } from '../dist/session-log-parser/index.js'
import { writeFile } from 'node:fs/promises'

const { values, positionals } = parseArgs({
  options: {
    output: { type: 'string', short: 'o' },
    constraint: { type: 'string', short: 'c' },
    'default-show-process': { type: 'boolean', default: false },
  },
  allowPositionals: true,
})

const [command, inputPath] = positionals

if (command === 'parse') {
  if (!inputPath) {
    console.error('Usage: openclaw-chats-share parse <session.log> [-o output.yaml]')
    process.exit(1)
  }

  const { readFileSync } = await import('node:fs')
  const content = readFileSync(inputPath, 'utf-8')
  const parser = new LogParser()
  const session = parser.parseContent(content)

  const generator = new YAMLGenerator(DEFAULT_CONSTRAINT, {
    defaultShowProcess: values['default-show-process'],
  })
  const yaml = generator.generate(session)

  const outputPath = values.output || inputPath.replace('.jsonl', '.yaml')
  await writeFile(outputPath, yaml)

  console.log(`Generated: ${outputPath}`)
} else {
  console.log('Commands: parse <session.log>')
  process.exit(1)
}
