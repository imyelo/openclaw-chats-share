# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a monorepo for Openclaw conversation sharing tools. It includes a CLI for parsing session logs, a web package for generating static sites, and a demo project.

## Project Structure

```
packages/
  cli/           - openclaw-chats-share CLI package
    src/
      session-log-parser/  - Parse Openclaw session JSONL files ({id}.jsonl)
      format-constraint/   - Define and validate YAML output format constraints
      yaml-generator/      - Generate YAML files from parsed sessions
    test/                  - Bun tests for all three modules
  web/           - openclaw-chats-share-web package (Astro-based)
    src/
      pages/               - index.astro (chat index), share/[slug].astro (per-chat)
      components/          - MessageHeader.astro, ChatMessage.astro, CollapsibleMessage.tsx (React), Footer.astro, MemoryBackground.astro
      layouts/             - ChatLayout.astro
      lib/chats.ts         - Reads chats/ from monorepo root (or chats_dir config)
      lib/config-schema.ts - Zod schema for chats-share.toml (ChatsShareConfigSchema)
      lib/config.ts        - Runtime config loader with validation
      constants/index.ts   - Message type color/style maps
  create/        - create-openclaw-chats-share scaffolding tool
    test/                  - Bun snapshot tests for scaffold output
chats/           - Chat YAML files (read by web package at build time)
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
npx openclaw-chats-share parse <{id}.jsonl> [-o output.yaml]
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
2. **`FormatConstraint`** (`format-constraint/`) — schema object that defines which fields and timeline entries to include; `DEFAULT_CONSTRAINT` covers the common case
3. **`YAMLGenerator`** (`yaml-generator/`) — takes `ParsedSession` + `FormatConstraint`, renders a top-level metadata map + `timeline:` array into a YAML string

### Web Data Flow

At build time, `packages/web/src/lib/chats.ts` reads all `*.yaml` files from the chats directory. The default path is `../../chats/` (monorepo root relative to `packages/web/`), but it can be overridden via `chats_dir` in `chats-share.toml`. During `dev`, a Vite plugin watches external chats directories for hot-reload. The module exports `getAllChats()` (frontmatter only) and `getAllChatsWithContent()` (frontmatter + parsed message blocks). Frontmatter is parsed manually (no external library). The Astro pages at `src/pages/index.astro` and `src/pages/share/[slug].astro` consume this data.

Only chats with `visibility: public` (or no visibility field) are shown in the index. All slugs (including `private`) get individual pages and are accessible via direct URL.

### Session File Format

Openclaw session files (`{id}.jsonl`) are JSONL files with these event types:
- `session` - Session metadata (id, timestamp, cwd)
- `message` - Messages with role (`user`/`assistant`/`toolResult`), content blocks (`text`/`thinking`/`toolCall`)
- `model_change` - Model switching events
- `thinking_level_change` - Thinking level changes
- `custom` - Custom events like model-snapshot

### Chat YAML Timeline Format

Chat files are pure YAML. Top-level fields are metadata; a `timeline:` array contains ordered event and message objects.

Each timeline entry has a `type` field:
- `message` — user/assistant message; may have `content` (text), `process[]` (thinking/tool_call blocks)
- `session`, `model_change`, `thinking_level_change`, `compaction`, `custom` — non-message events rendered as collapsible panels

UI panel colors by type: `thinking` / `thinking_level_change` (gray), `tool_call` with error (red), `session` (green), `model_change` / `compaction` / `custom` (indigo). Color/style maps live in `packages/web/src/constants/index.ts`.

See [docs/chats-share-data-format.md](/docs/chats-share-data-format.md) for the full schema and examples.

## Additional Resources

- See [docs/openclaw-session-log-format-search.md](/docs/openclaw-session-log-format-search.md) for detailed event schemas.
- See [docs/chats-share-data-format.md](/docs/chats-share-data-format.md) for complete frontmatter fields and content format.
- See [docs/cli-platform-extension.md](/docs/cli-platform-extension.md) for the `--platform` flag, the `Platform` interface, and how to add new platform parsers.

---

## Web Package — CSS & Component Architecture

> Applies to `packages/web/`.

### CSS — where does a style belong?

| Where is the style needed? | Correct mechanism |
|---|---|
| Every page (reset, body, tokens) | `src/styles/global.css` / `tokens.css` |
| An `.astro` layout or component | `<style>` block in that file |
| A React (`.tsx`) component | `.module.css` adjacent to the file |
| Styles injected via `set:html` | `:global(...)` inside a scoped `<style>` block |

Rules:
- `tokens.css` is the single source of truth for every design value. Never hard-code a color, font, or spacing constant — reference the token with `var(--token-name)`.
- `<style>` blocks in `.astro` files are auto-scoped by Astro. Do not extract them into external `.css` files.
- CSS Module class names are camelCase. Conditional states are separate classes toggled with the `cn()` helper, never string interpolation.
- Semi-transparent colours use `color-mix(in srgb, var(--token) 50%, transparent)`.

### Components — `.astro` vs `.tsx`

Use `.astro` by default. Use `.tsx` only when `useState` or event handlers are required.

| File | Type | Reason |
|---|---|---|
| `MessageHeader.astro` | Astro | Stateless |
| `ChatMessage.astro` | Astro | Stateless |
| `CollapsibleMessage.tsx` | React | `useState` for expand/collapse |
| `Footer.astro` | Astro | Stateless |
| `MemoryBackground.astro` | Astro | Stateless |

**MessageHeader duplication:** `CollapsibleMessage.tsx` contains its own private React `MessageHeader`. This is intentional — Astro components cannot be imported into React (the boundary is one-way), so the small header is duplicated rather than pulling the whole tree into React.

**`set:html` + markdown:** `ChatMessage.astro` renders markdown with `new Marked()` (a fresh instance, not the global `marked`). Using the global would inherit the custom link renderer registered in `Footer.astro`. Prose styles use `.message-content :global(element)` selectors because `set:html` content does not carry Astro's scoping attribute.

### PostCSS & TypeScript

PostCSS (`autoprefixer`) is configured inside `astro.config.mjs` via `vite.css.postcss` — not in a separate `postcss.config.cjs` — so it is included in the published npm package's `files` list.

The CSS Module type shim (`declare module '*.module.css'`) lives in `src/env.d.ts`. It is only needed for `tsc --noEmit`; `astro check` resolves modules independently.
