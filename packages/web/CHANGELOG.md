# openclaw-chats-share-web

## 0.3.0

### Minor Changes

- 0756090: Move chat detail route from /share/[slug] to /chats/[slug]

  - Chat detail pages are now accessible at `/chats/[slug]` instead of `/share/[slug]`
  - This provides a cleaner URL structure for viewing shared chats

## 0.2.0

### Minor Changes

- b174aed: Add web configuration enhancements and new UI components

  - Add Zod config schema with validation for chats-share.toml
  - Add customizable footer component support
  - Add memory background effect for chat pages
  - Add custom chats directory support with external file watching
  - Add configurable meta options (title, description)
  - Extract chat file-reading logic into reusable lib/chats module

## 0.1.0

### Minor Changes

- 86144f9: Initial release of openclaw-chats-share monorepo

  - CLI tool for parsing Openclaw session logs to markdown
  - Astro-based web package for sharing conversations
  - Scaffold tool for creating new chat share projects
