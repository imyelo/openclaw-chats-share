# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a monorepo for Openclaw conversation sharing tools. It includes a CLI for parsing session logs, a web package for generating static sites, and a demo project.

## Project Structure

```
packages/
  cli/           - openclaw-chats-share CLI package
    src/
      session-log-parser/  - Parse Openclaw session.log JSONL files
      format-constraint/   - Define and validate md output format constraints
      md-generator/        - Generate markdown files from parsed sessions
    test/                  - Bun tests for all three modules
  web/           - openclaw-chats-share-web package (Astro-based)
    src/
      pages/               - index.astro (chat index), share/[slug].astro (per-chat)
      components/          - ChatComponents.tsx (React)
      layouts/             - ChatLayout.astro
      lib/chats.ts         - Reads chats/ from monorepo root
      constants/index.ts   - Message type color/style maps
  create/        - create-openclaw-chats-share scaffolding tool
    test/                  - Bun snapshot tests for scaffold output
chats/           - Chat Markdown files (read by web package at build time)
skills/          - Openclaw skills
```

## Commands

```bash
# Install dependencies
bun install

# Demo: Run dev server
bun run dev

# Demo: Build static site
bun run build

# Run all tests
bun run test

# Run tests in CLI package only
cd packages/cli && bun test

# Run a single test file
cd packages/cli && bun test test/session-log-parser.test.ts

# Run tests in create package only
cd packages/create && bun test
```

## Packages

### openclaw-chats-share (CLI)
```bash
npx openclaw-chats-share parse <session.log> [-o output.md]
```

### openclaw-chats-share-web
```bash
npx openclaw-chats-share-web dev|build|preview
```

### create-openclaw-chats-share
```bash
npx create-openclaw-chats-share <project-name>
```

## Architecture

### CLI Pipeline

The CLI processes session data through three sequential stages:

1. **`LogParser`** (`session-log-parser/`) — reads a JSONL file, emits `ParsedSession` (`meta` + `messages[]` + `modelChanges[]`)
2. **`FormatConstraint`** (`format-constraint/`) — schema object that defines which YAML frontmatter fields and which content sections to include; `DEFAULT_CONSTRAINT` covers the common case
3. **`MDGenerator`** (`md-generator/`) — takes `ParsedSession` + `FormatConstraint`, renders YAML frontmatter + section bodies into a markdown string

### Web Data Flow

At build time, `packages/web/src/lib/chats.ts` reads all `*.md` files from `../../chats/` (monorepo root) relative to `packages/web/`. It parses frontmatter manually (no external library). The Astro pages at `src/pages/index.astro` and `src/pages/share/[slug].astro` consume this data.

Only chats with `visibility: public` (or no visibility field) are shown in the index. All slugs (including `private`) get individual pages and are accessible via direct URL.

### Session Log Format

Openclaw session.log is a JSONL file with these event types:
- `session` - Session metadata (id, timestamp, cwd)
- `message` - Messages with role (`user`/`assistant`/`toolResult`), content blocks (`text`/`thinking`/`toolCall`)
- `model_change` - Model switching events
- `thinking_level_change` - Thinking level changes
- `custom` - Custom events like model-snapshot

### Chat Markdown Special Blocks

Non-message events in chat files use a fenced directive syntax rendered by the web package as collapsible panels:

```
:::{type=thinking_level_change,collapsed=true}
🧠 **Thinking**
content...
:::
```

Supported types and their UI colors: `thinking_level_change` (gray), `error` (red), `session` (green), `custom` (indigo). Color/style maps live in `packages/web/src/constants/index.ts`.
