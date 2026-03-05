# openclaw-chats-share

## 0.4.0

### Minor Changes

- Add CLI event filtering flags, OG image support, and custom page configuration

  - CLI: Add `--include-process` flag to filter timeline events by type (thinking, tool_call, tool_result, message, session, model_change, compaction, custom)
  - CLI: Add `--exclude-process` option to exclude specific event types from output
  - Web: Add OG image support with auto-generated SVG cover cards for social sharing
  - Web: Add version display to generated footer
  - Web: Add support for custom page descriptions and site title via config
  - Docs: Add CLI platform extension documentation

## 0.3.0

### Minor Changes

- Improved the stability of log parsing.

## 0.2.1

### Patch Changes

- Release for changes since last version

  - cli: Update tests and lint for participants field
  - web: Adjust CollapsibleMessage chevron sizing and padding
  - web: Allow Vite fs to serve host project files when installed as package

## 0.2.0

### Minor Changes

- Add participants frontmatter field and refactor web styling

  - Add `participants` frontmatter field for human/agent classification
  - Replace UnoCSS with PostCSS and CSS Modules
  - Overhaul typography system
  - Fix user/agent message detection

## 0.1.0

### Minor Changes

- 86144f9: Initial release of openclaw-chats-share monorepo

  - CLI tool for parsing Openclaw session logs to markdown
  - Astro-based web package for sharing conversations
  - Scaffold tool for creating new chat share projects
