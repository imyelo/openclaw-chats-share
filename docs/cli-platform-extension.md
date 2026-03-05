# CLI Platform Extension

The CLI supports a `--platform` flag that selects which parser to use when reading session log files. This makes it possible to add support for conversation formats other than Openclaw in the future without changing the core pipeline.

## Current Status

Only the `openclaw` platform is implemented. The extension point exists but is not yet a stable public API — the interface and registry may change.

## CLI Usage

```bash
openclaw-chats-share parse <file> [--platform <name>]
# or
openclaw-chats-share parse <file> [-p <name>]
```

The default is `openclaw`. Specifying an unknown platform name prints an error and exits:

```
Unknown platform: foo. Available: openclaw
```

## The `Platform` Interface

`packages/cli/src/platform.ts`:

```typescript
export interface Platform {
  readonly name: string
  /** Parse JSONL content string into a ParsedSession */
  parse(content: string): ParsedSession
  /** Read a file at filePath and parse it into a ParsedSession */
  parseFile(filePath: string): Promise<ParsedSession>
}
```

Both `parse` and `parseFile` must return a `ParsedSession` (defined in `session-log-parser/index.ts`). The `parseFile` method is what the CLI calls directly; `parse` is used for unit testing without hitting the filesystem.

## Built-in Platform: `openclaw`

`packages/cli/src/platforms/openclaw.ts` — `OpenClawParser implements Platform`

Reads Openclaw session JSONL files (`{id}.jsonl`). Key behaviours:

- **Role mapping** — Openclaw roles (`user`/`assistant`) are mapped to the canonical chats-share roles (`human`/`agent`). `toolResult` is kept as-is.
- **External channel cleaning** — User messages may carry Discord / Telegram metadata prefixes injected by Openclaw's channel integrations. The parser strips these before writing the YAML.
- **Exec result extraction** — `System: [...] Exec completed/failed (...)` lines are discarded from user message content.
- **Thinking blocks** — Included by default (`includeThinking: true`). Can be suppressed via `ParserOptions`.
- **Usage data** — Token usage and stop reason are included by default (`includeUsage: true`).

`OpenClawParser` accepts a `ParserOptions` object in its constructor:

```typescript
interface ParserOptions {
  includeThinking?: boolean  // default: true
  includeUsage?: boolean     // default: true
}
```

## Adding a New Platform

1. Create `packages/cli/src/platforms/<name>.ts` and export a class that implements `Platform`.
2. Register it in `packages/cli/bin/cli.js` inside the `PLATFORMS` map:

```js
const PLATFORMS = {
  openclaw: async () => { ... },
  myplatform: async () => {
    const { MyPlatformParser } = await import('../dist/platforms/myplatform.js')
    return new MyPlatformParser()
  },
}
```

3. The CLI will automatically surface it in error messages and accept it as a `--platform` value.

The `Platform` type is exported from the package entry point (`packages/cli/src/index.ts`) so external consumers can implement it too, though programmatic multi-platform support is not documented as a stable API yet.
