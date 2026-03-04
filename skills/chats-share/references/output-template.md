# Output Template: chats-share YAML

Use this when converting any session to chats-share format.
Full field reference: `docs/chats-share-data-format.md` in the project root.

> **Content fidelity rule**: Copy all message text, tool arguments, and tool results verbatim from the session data. Do NOT paraphrase, summarize, translate, or reword any content. Format conversion only.

## Top-level Metadata Fields

```yaml
title: {descriptive title}
description: {one-sentence summary}
date: {YYYY-MM-DD}
sessionId: {session-id}
model: {first model used}
totalMessages: {count of user+assistant message events; exclude toolResult}
totalTokens: {sum of usage.totalTokens across all messages; omit if unavailable}
visibility: public
defaultShowProcess: false
participants:
  {DisplayName}:
    role: human
  {DisplayName}:
    role: agent
    model: {model-name}
```

## Timeline Array

After the metadata fields, a `timeline:` key holds an ordered list of event and message objects.

### Non-message Event Types

| `type` | Required fields | Notes |
|--------|-----------------|-------|
| `session` | `cwd` | Session start |
| `model_change` | `model`, `provider` | Model switch |
| `thinking_level_change` | `level` | e.g. `"off"`, `"medium"` |
| `compaction` | `tokensBefore` | Context compaction |
| `custom` | `customType`; for model-snapshot: `model`, `provider` | Custom events |

All events also have `timestamp`.

### Message Type

```yaml
- type: message
  role: human | agent
  speaker: {DisplayName}
  timestamp: {ISO 8601}
  model: {model-name}         # assistant only, if available
  thinking: |                 # assistant only, if model reasoning was captured
    {reasoning text verbatim}
  content: |
    {message text verbatim}
  toolCalls:                  # assistant only, if tools were called
    - id: {tool-call-id}
      name: {tool-name}
      arguments:
        {key}: {value}        # structured object, verbatim from session
      result:
        content: |
          {result text verbatim}
        isError: false
  images:                     # if message contains images
    - mimeType: image/png
      data: {base64}
```

Use YAML block scalar (`|`) for any multiline string field (`thinking`, `content`, result `content`). Single-line strings may use plain or quoted YAML style.

## File Naming

```
YYYYMMDD-{slug}.yaml
```

## Full Example

```yaml
title: Debugging an async race condition
description: Tracked down a race condition in a Node.js event emitter.
date: 2026-03-03
sessionId: cf1f8dbe-2a12-47cf-8221-9fcbf0c47466
model: claude-sonnet-4-6
totalMessages: 8
totalTokens: 12345
visibility: public
defaultShowProcess: false
participants:
  Alice:
    role: human
  Claude:
    role: agent
    model: claude-sonnet-4-6

timeline:
  - type: session
    timestamp: "2026-03-03T14:00:00.000Z"
    cwd: ~/projects/myapp

  - type: model_change
    timestamp: "2026-03-03T14:00:01.000Z"
    model: claude-sonnet-4-6
    provider: anthropic

  - type: thinking_level_change
    timestamp: "2026-03-03T14:00:02.000Z"
    level: "off"

  - type: message
    role: human
    speaker: Alice
    timestamp: "2026-03-03T14:01:00.000Z"
    content: |
      I'm seeing a race condition in my event emitter setup. Here's the code...

  - type: message
    role: agent
    speaker: Claude
    timestamp: "2026-03-03T14:02:00.000Z"
    model: claude-sonnet-4-6
    thinking: |
      The issue is likely in how the drain event interacts with the write queue.
      Let me look at the emitter source to confirm.
    content: |
      The problem is on line 17 — you're registering the listener inside the loop...
    toolCalls:
      - id: tc_001
        name: read
        arguments:
          file_path: src/emitter.ts
        result:
          content: |
            // EventEmitter source
            class Emitter {
              // ...42 lines
            }
          isError: false
```
