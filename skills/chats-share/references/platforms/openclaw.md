# Agent Profile: OpenClaw

## Config Lookup

Read project dir from `~/.openclaw/workspace/TOOLS.md`:
1. Find the `## chats-share` section
2. Extract the `- Project: {path}` value

If not found → [First-Time Setup](../setup.md)

Also read `site` URL from `{projectDir}/chats-share.toml`.

## Session Discovery

```bash
ls -t ~/.openclaw/agents/main/sessions/*.jsonl
```

Filter by:
- `sessionId=xxx` → grep exact session ID in filename
- `topic=xxx` → grep keyword in file content
- `current` → use the most recent (first result from `ls -t`)

Show candidates → confirm with user.

## Session Format

JSONL — one JSON object per line. Event types:

| Type | Key fields |
|------|------------|
| `session` | `id`, `timestamp`, `cwd` |
| `message` | `message.role`, `message.content[]`, `message.model`, `timestamp`; for toolResult: `message.toolCallId`, `message.toolName`, `message.isError` |
| `model_change` | `modelId`, `provider` |
| `thinking_level_change` | `thinkingLevel` |
| `custom` | `customType`; for `model-snapshot`: `data.modelId`, `data.provider` |
| `compaction` | `tokensBefore` |

Full schemas: `docs/openclaw-session-log-format-search.md`

## Message Content Block Extraction

Each `message` event has this structure:
```json
{
  "type": "message",
  "id": "...",
  "timestamp": "...",
  "message": {
    "role": "user" | "assistant" | "toolResult",
    "content": [ /* array of content blocks */ ],
    "model": "...",
    "toolCallId": "...",
    "toolName": "...",
    "isError": false,
    "usage": { "totalTokens": 123, ... }
  }
}
```

Extract from `message.content[]` by block type:

| Block `type` | Extract | Notes |
|---|---|---|
| `text` | `.text` string | Concatenate multiple text blocks. For `role=user`, apply external channel cleaning (see below). |
| `thinking` | `.thinking` string | Full reasoning text — never skip or summarize |
| `toolCall` | `.id`, `.name`, `.arguments` (object) | One toolCall block per message |
| `image` | `.source.media_type` + `.source.data` (base64), or `.mimeType` + `.data` | Embed as data URI |

For `role=toolResult` messages, the tool identity fields are on `message` itself, not in content blocks:
- `message.toolCallId` — links to the matching toolCall
- `message.toolName` — name of the tool
- `message.isError` — true if the result is an error
- Content text is still extracted from `message.content[]` text blocks

### External Channel Message Cleaning (user messages only)

Strip metadata wrappers that Openclaw injects for Discord/Telegram messages. Apply these in order:

1. **Discord full prefix**: `[Discord Guild #channel ...] user: {content} [from: user]` → keep `{content}`
2. **Trailing suffix**: `{content} [from: user]` or `{content} [message_id: xxx]` → keep `{content}`
3. **Telegram prefix**: `user (username): {content}` → keep `{content}`
4. **Remove these inline blocks** (strip entirely):
   - `[media attached: /path/to/file (mime/type) | /path]` lines
   - `Conversation info (untrusted metadata):\n```json\n...\n` ``` blocks
   - `Sender (untrusted metadata):\n```json\n...\n` ``` blocks
   - `To send an image back, prefer...` instruction lines
   - `<media:image> (N image)` marker lines
5. **Chat history block**: `Chat history since last reply (untrusted, for context):\n```json\n[...]\n` ``` — extract the `body` field of the last entry, prepend it as message content, then remove the block
6. **Discord mention tags**: `<@1234567890>` at end of message → remove
7. Trim leading/trailing whitespace

## Metadata Extraction

`totalMessages`: count only `message`-type JSONL events with `role: user` or `role: assistant`. Exclude `toolResult` and all other event types.

Participants:
- `role: "user"` → human participant
- `role: "assistant"` → agent participant (capture `model` field from the message)
- `role: "toolResult"` → part of the assistant turn, not a separate participant

For large files → [large-file.md](../large-file.md)

## Registration

Append to `~/.openclaw/workspace/TOOLS.md`:

```bash
echo -e "\n## chats-share\n\n- Project: {absolute-path-to-project}\n" >> ~/.openclaw/workspace/TOOLS.md
```

This entry is what Config Lookup reads (see above).

## Output Format

For how to render each event and message type as chats-share YAML, see [output-template.md](../output-template.md).
