# Openclaw Session Log Format Research

The CLI parses Openclaw `session.log` files — JSONL where each line is a JSON event. The research data is contributed by the [@lambda610](https://github.com/lambda610).

## Event Types (top-level `type` field)

| Type | Description |
|------|-------------|
| `message` | A user, assistant, or tool-result message |
| `session` | Session start (id, cwd, version) |
| `model_change` | Model switched (provider, modelId) |
| `thinking_level_change` | Thinking level changed (thinkingLevel) |
| `custom` | Custom event, e.g. `model-snapshot` |
| `compaction` | Context compacted (summary, tokensBefore) |

## Top-Level Fields by Event Type

| Field | Types | Description |
|-------|-------|-------------|
| `id` | all | Unique event ID |
| `parentId` | message, model_change, thinking_level_change, custom, compaction | Parent event ID |
| `timestamp` | all | ISO 8601 timestamp |
| `type` | all | Event type (see table above) |
| `version` | session | Session log version |
| `cwd` | session | Working directory |
| `provider` | message, model_change | Model provider |
| `modelId` | model_change | Model identifier |
| `thinkingLevel` | thinking_level_change | e.g. `"off"`, `"low"`, `"high"` |
| `customType` | custom | Sub-type, e.g. `"model-snapshot"` |
| `data` | custom | Arbitrary payload |
| `summary` | compaction | Markdown summary of compacted context |
| `details` | compaction | Additional compaction metadata |
| `firstKeptEntryId` | compaction | ID of first event retained after compaction |
| `tokensBefore` | compaction | Token count before compaction |

## Event Schemas

### `message`

```json
{
  "type": "message",
  "id": "abcdefgh",
  "parentId": "ijklmnop",
  "timestamp": "2026-02-15T06:13:50.514Z",
  "message": {
    "role": "user",
    "content": [...],
    "api": "anthropic-messages",
    "provider": "minimax",
    "model": "MiniMax-M2.5",
    "usage": {},
    "stopReason": "stop",
    "timestamp": 1771136030512
  }
}
```

**Message roles:** `user`, `assistant`, `toolResult`

### `toolResult` role details

When `message.role` is `toolResult`, the `message` object contains additional fields:

```json
{
  "type": "message",
  "id": "abcdefgh",
  "parentId": "ijklmnop",
  "timestamp": "2026-02-17T23:02:52.110Z",
  "message": {
    "role": "toolResult",
    "toolCallId": "call_function_ku2otjcs93sj_1",
    "toolName": "write",
    "content": [
      { "type": "text", "text": "Successfully wrote 752 bytes to /tmp/foobar.md" }
    ],
    "isError": false,
    "details": {
      "diff": "...",
      "firstChangedLine": 36
    },
    "timestamp": 1771369372104
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `toolCallId` | string | ID of the tool call this result responds to |
| `toolName` | string | Name of the tool that was executed |
| `isError` | boolean | Whether the tool execution failed |
| `details` | object | Tool-specific metadata (e.g., diff for edit tool) |

### `message.usage` details

Assistant messages include usage statistics:

```json
{
  "usage": {
    "input": 8,
    "output": 458,
    "cacheRead": 1260,
    "cacheWrite": 9118,
    "totalTokens": 10844,
    "cost": {
      "input": 0.00012,
      "output": 0.02748,
      "cacheRead": 0.00252,
      "cacheWrite": 0.09118,
      "total": 0.1213
    }
  }
}
```

### `session`

```json
{
  "type": "session",
  "version": 3,
  "id": "cf1f8dbe-2a12-47cf-8221-9fcbf0c47466",
  "timestamp": "2026-02-15T06:13:50.506Z",
  "cwd": "/home/user/.openclaw/workspace"
}
```

### `model_change`

```json
{
  "type": "model_change",
  "id": "1d467322",
  "parentId": null,
  "timestamp": "2026-02-15T06:13:50.507Z",
  "provider": "minimax",
  "modelId": "MiniMax-M2.5"
}
```

### `thinking_level_change`

```json
{
  "type": "thinking_level_change",
  "id": "8e453aed",
  "parentId": "1d467322",
  "timestamp": "2026-02-15T06:13:50.507Z",
  "thinkingLevel": "off"
}
```

### `custom`

```json
{
  "type": "custom",
  "customType": "model-snapshot",
  "data": {
    "timestamp": 1771136030507,
    "provider": "minimax",
    "modelApi": "anthropic-messages",
    "modelId": "MiniMax-M2.5"
  },
  "id": "abcdefgh",
  "parentId": "ijklmnop",
  "timestamp": "2026-02-15T06:13:50.508Z"
}
```

### `compaction`

```json
{
  "type": "compaction",
  "id": "abcdefgh",
  "parentId": "26c4b7ec",
  "timestamp": "2026-02-15T08:56:28.207Z",
  "summary": "## Goal\n1. Analyze...",
  "details": {},
  "firstKeptEntryId": "...",
  "tokensBefore": 12345
}
```

## `message.content[]` Element Types

Each `message` event has a `content` array. Element types:

### `text`

```json
{ "type": "text", "text": "message content" }
```

### `thinking`

```json
{
  "type": "thinking",
  "thinking": "reasoning content...",
  "thinkingSignature": "<sha256 signature>"
}
```

### `toolCall`

```json
{
  "type": "toolCall",
  "id": "call_function_xxx",
  "name": "write",
  "arguments": {
    "content": "# Document content\n\n...",
    "file_path": "/home/user/notes.md"
  }
}
```

Common tool argument fields:

| Tool | Arguments |
|------|-----------|
| `read` | `file_path` |
| `write` | `file_path`, `content` |
| `edit` | `file_path`, `oldText`, `newText` |
| `exec` | `command` |

### `image`

```json
{
  "type": "image",
  "source": {
    "type": "base64",
    "media_type": "image/png",
    "data": "<base64 encoded data>"
  }
}
```

### Voice / Media Attachments

Openclaw converts voice, image files, and other media attachments to `text` entries using a reference syntax:

```json
{
  "type": "text",
  "text": "[media attached: /path/to/file.ogg (audio/ogg; codecs=opus) | /path/to/file.ogg]"
}
```

Media files are stored under `~/.openclaw/media/inbound/`.
