# Output Template: chats-share Markdown

Use this when converting any session to chats-share format.
Full field reference: `docs/chats-share-data-format.md` in the project root.

> **Content fidelity rule**: Copy all message text, tool arguments, and tool results verbatim from the session data. Do NOT paraphrase, summarize, translate, or reword any content. Format conversion only.

## Frontmatter

```yaml
---
title: {descriptive title}
description: {one-sentence summary}
date: {YYYY-MM-DD}
sessionId: {session-id}
model: {first model used}
totalMessages: {count of all message-type JSONL events}
totalTokens: {sum of usage.totalTokens across all messages, omit if unavailable}
visibility: public
defaultShowProcess: false
participants:
  {DisplayName}:
    role: human
  {DisplayName}:
    role: agent
    model: {model-name}
---
```

## Header Block

Immediately after frontmatter:

```markdown
# {title}

> {YYYY-MM-DD}

---
```

## Message Block

```markdown
**{DisplayName}** · {ISO timestamp}

{message content verbatim}
```

Each message (and each standalone event block) is separated from the next by a `---` rule.

## Thinking Block (inside message)

Placed before message text, inside the same message block:

```markdown
:::{type=thinking_level_change,collapsed=true}
🧠 **Thinking**
{model reasoning text verbatim}
:::

{message text}
```

## Collapsible Block Types

```markdown
:::{type=thinking_level_change,collapsed=true}
🧠 **Thinking** level: {level}
:::

:::{type=custom,collapsed=true}
{tool call / model change / custom event content}
:::

:::{type=error,collapsed=false}
{error content}
:::

:::{type=session,collapsed=true}
{session metadata}
:::
```

## Code Fencing Rules

Two rules apply whenever content is placed inside a code fence (`` ``` ``):

### 1. Adaptive fence length

Use enough backticks so the fence cannot appear *inside* the content. Count the longest consecutive run of backticks in the content, then use one more:

| Longest run in content | Fence to use |
|---|---|
| 0–2 (no backticks, or `` ` `` / ` `` `) | ` ``` ` (3 backticks — minimum) |
| 3 (` ``` `) | ```` ```` ```` (4 backticks) |
| 4 (```` ```` ````) | ````` ````` ````` (5 backticks) |
| N | N+1 backticks |

Example — a tool result that itself contains a code block:
````markdown
````
Here is some output:
```json
{"key": "value"}
```
````
````

### 2. Strip bare `---` lines from write/edit content

The `---` sequence on a line by itself is the chats-share message separator. Remove any such lines from `write.content`, `edit.oldText`, and `edit.newText` before placing them in a code fence. Other content fields (tool results, exec output, etc.) are not stripped — they are just fenced, so `---` inside a fence is safe.

## Tool Call Block (success)

Full argument details and full result content — never summarize:

```markdown
:::{type=custom,collapsed=true}
🔧 **Tool Call - {toolName}** · {file_path (if applicable)}

***

{formatted arguments — see per-tool format below}

***

```
{result content verbatim}
```
:::
```

Use adaptive fence length (see above) for the result content block.

### Per-tool argument format

| Tool | Arguments |
|------|-----------|
| `read` | `**File**: \`{file_path}\`` |
| `write` | `**File**: {file_path}`<br>`**Content** ({N} chars):` + code fence around content with `---` lines stripped |
| `edit` | `**File**: {file_path}`<br>`**Old**:` + code fence around oldText with `---` lines stripped<br>`**New**:` + code fence around newText with `---` lines stripped |
| `exec` | `**Command**:` + code fence around command |
| `process` | `**Process**: {name}`<br>`**Command**:` + code fence around command |
| `curl` | `**Method**: {method}`<br>`**URL**: {url}`<br>`**Body**:` + code fence around body |
| Other | `**{argName}**:` + code fence around value (JSON-stringify non-strings) for each argument |

## Tool Call Block (failure)

```markdown
:::{type=error,collapsed=false}
🔧 **Tool Call - {toolName}** · {file_path (if applicable)}

***

{formatted arguments}

***

```
{error content verbatim}
```
:::
```

Same adaptive fencing applies to the error content block.

## Tool Result Block (legacy — standalone, no matching tool call)

Used when a toolResult message has no corresponding toolCall:

```markdown
:::{type=custom,collapsed=true}
✅ **{toolName}** · {result content}
:::
```

Or for errors:

```markdown
:::{type=error,collapsed=false}
❌ **{toolName}** · {error content}
:::
```

## Image Block

When a message contains an image, embed it as a data URI:

```markdown
![image/png](data:image/png;base64,{base64-data})
```

If the image data is not directly accessible, use a descriptive placeholder: `[image]`

## Non-message Event Blocks

| Event | Format |
|-------|--------|
| `model_change` | `:::{type=custom,collapsed=true}`<br>`🔧 **Model Change**: {modelId} ({provider})`<br>`:::` |
| `thinking_level_change` | `:::{type=thinking_level_change,collapsed=true}`<br>`🧠 **Thinking** level: {level}`<br>`:::` |
| `session` | `:::{type=session,collapsed=true}`<br>`Session started ({cwd})`<br>`:::` |
| `compaction` | `:::{type=custom,collapsed=true}`<br>`🗜️ **Context Compaction**: {tokensBefore} tokens`<br>`:::` |
| `custom` (generic) | `:::{type=custom,collapsed=true}`<br>`⚙️ {customType}`<br>`:::` |
| `custom` (model-snapshot) | `:::{type=custom,collapsed=true}`<br>`⚙️ **model-snapshot**: {modelId} ({provider})`<br>`:::` |

## Full Example

```markdown
---
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
---

# Debugging an async race condition

> 2026-03-03

---

:::{type=session,collapsed=true}
Session started (~/projects/myapp)
:::

---

:::{type=custom,collapsed=true}
🔧 **Model Change**: claude-sonnet-4-6 (anthropic)
:::

---

:::{type=thinking_level_change,collapsed=true}
🧠 **Thinking** level: off
:::

---

**Alice** · 2026-03-03T14:01:00.000Z

I'm seeing a race condition in my event emitter setup. Here's the code...

---

**Claude** · 2026-03-03T14:02:00.000Z

:::{type=thinking_level_change,collapsed=true}
🧠 **Thinking**
The issue is likely in how the drain event interacts with the write queue.
Let me look at the emitter source to confirm.
:::

:::{type=custom,collapsed=true}
🔧 **Tool Call - read** · src/emitter.ts

***

**File**: `src/emitter.ts`

***

```
// EventEmitter source
class Emitter {
  // ...42 lines
}
```
:::

The problem is on line 17 — you're registering the listener inside the loop...
```
