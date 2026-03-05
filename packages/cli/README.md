# openclaw-chats-share

CLI for parsing Openclaw session JSONL files and generating chat YAML files for [openclaw-chats-share-web](https://github.com/imyelo/openclaw-chats-share/tree/main/packages/web/).

## Usage

```bash
npx openclaw-chats-share parse <session.jsonl> [-o output.yaml]
```

### Process Content Filtering

By default the output includes everything (thinking blocks, tool calls, events). Use these flags to filter:

```bash
# Messages only — strip all process content
npx openclaw-chats-share parse session.jsonl -o out.yaml --exclude-process=all

# Messages + specific types
npx openclaw-chats-share parse session.jsonl -o out.yaml --include-process=thinking,toolcalls
```

`--include-process` and `--exclude-process` are mutually exclusive.

| Type | What it covers |
|------|----------------|
| `thinking` | AI reasoning/thinking blocks |
| `toolcalls` | Tool call blocks (name, arguments) |
| `toolresults` | Tool result content embedded in tool call entries |
| `session` | Session start events |
| `model_change` | Model switching events |
| `thinking_level_change` | Thinking level change events |
| `compaction` | Context compaction events |
| `custom` | Custom events (e.g. model-snapshot) |
| `all` | Shorthand for all types above |

### Platform

The `--platform` flag selects the session format parser. Currently only `openclaw` is supported (the default).

```bash
npx openclaw-chats-share parse session.jsonl --platform openclaw
```

## Programmatic API

```ts
import { parseSession, generateYAML, DEFAULT_CONSTRAINT } from 'openclaw-chats-share'

const session = await parseSession(filePath)
const yaml = await generateYAML(session, DEFAULT_CONSTRAINT, { name: 'My Session' })
```

Key exports:

| Export | Description |
|--------|-------------|
| `parseSession` | Parse a JSONL file into a `ParsedSession` |
| `LogParser` / `OpenClawParser` | Low-level parser classes |
| `generateYAML` / `YAMLGenerator` | Render a `ParsedSession` to YAML string |
| `DEFAULT_CONSTRAINT` | Default `FormatConstraint` (includes all content) |
| `createConstraint` | Build a custom `FormatConstraint` |
| `Platform` | Interface for adding new platform parsers |

See [Chats-share's docs/cli-platform-extension.md](https://github.com/imyelo/openclaw-chats-share/blob/main/docs/cli-platform-extension.md) for how to implement a custom platform parser.
