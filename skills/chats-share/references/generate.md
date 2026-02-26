---
name: chats-share
description: "Use when user wants to share OpenClaw channel conversations externally"
metadata: {"openclaw":{"emoji":"💬","homepage":"https://github.com/imyelo/openclaw-chats-share"}}
---

# chats-share

Share OpenClaw conversations as public web pages.

## When to Use

- User wants to share a conversation externally
- User wants to export conversation history for docs

## Config

**Project dir**: Where `create-openclaw-chats-share` was run

- **OpenClaw**: Read from `~/.openclaw/workspace/TOOLS.md`
- **Other agents**: Pass as argument

**site**: Read `site` URL from `{projectDir}/chats-share.toml`

**outputDir**: `{projectDir}/chats/` (convention, not config)

## Steps

### Phase 1: Find Session

1. **Pre-check**: Check if a `chats-share` project dir is configured in TOOLS.md
   - Read `~/.openclaw/workspace/TOOLS.md`
   - If no project directory found → Run first-time setup (see "First Time Setup" section below)
2. Load project dir (from TOOLS.md or arguments)
3. Load `site` URL from `{projectDir}/chats-share.toml` (use as base for output URL)
4. Find session:
   - List all sessions: `ls -t ~/.openclaw/agents/main/sessions/*.jsonl`
   - Filter by:
     - `sessionId=xxx` → grep exact ID
     - `topic=xxx` → grep topic keyword in content
     - `current` → use most recent (first line after ls -t)
   - Show candidates to user for confirmation

### Phase 2: Parse Session (Dual Mode)

This skill supports two modes. Choose based on session size and complexity:

**Mode A - CLI Tool (recommended for most cases):**
```bash
npx openclaw-chats-share parse ~/.openclaw/agents/main/sessions/{sessionId}.jsonl -o {projectDir}/chats/{name}.md
```

**Mode B - Prompt-Based (for complex/large sessions):**

**⚠️ CRITICAL: Keep original content unchanged**
- Only convert format, do NOT modify message content
- Do not summarize, rephrase, or edit any user/assistant messages
- Preserve all whitespace, punctuation, and special characters
- If content is too long, truncate but mark it as partial

**Small files (< 1MB, < 500 messages)**: Read directly with read tool

**Large files (> 1MB or > 500 messages)**: Preprocess first:

#### Step 2a: Check size
```bash
ls -lh {session}.jsonl
wc -l {session}.jsonl
```

#### Step 2b: Strip base64/images, extract text
```bash
jq -r '
  if .type == "message" then
    .message.content[]?.text // ""
  elif .type == "thinking" then
    "[Thinking]\n" + (.thinking // "")
  elif .type == "tool_call" then
    "[Tool Call]\n" + (.tool_calls[].name // "unknown") + "\n" + (.tool_calls[].arguments | tostring)
  elif .type == "tool_result" then
    "[Tool Result]\n" + (.toolResult.content[0:2000] // "")  # Truncate long results
  elif .type == "custom" then
    "[Custom] " + (.customType // "unknown") + " - " + (.data | tostring)
  elif .type == "model_change" then
    "[Model Change] " + .modelId
  elif .type == "thinking_level_change" then
    "[Thinking Level] " + .thinkingLevel
  else empty end
' {session}.jsonl > {projectDir}/chats/.tmp/{name}-raw.txt
```

#### Step 2c: If still too large, chunk it
**Option A - Truncate to recent messages:**
```bash
tail -200 {projectDir}/chats/.tmp/{name}-raw.txt > {projectDir}/chats/.tmp/{name}-truncated.txt
```

**Option B - Split into chunks:**
```bash
# Split into 500-line chunks
split -l 500 {projectDir}/chats/.tmp/{name}-raw.txt {projectDir}/chats/.tmp/{name}-chunk_

# Process each chunk with prompt, then merge
```

**Option C - Summary-first approach:**
```bash
# 1. Summarize the full session (extract key topics only)
jq -r 'select(.type == "message") | .message.content[]?.text' {session}.jsonl | head -50 > {projectDir}/chats/.tmp/{name}-preview.txt

# 2. Based on summary, decide which part to process fully
```

#### Step 2d: Generate markdown via prompt
Send prompt to convert the processed text to chats-share format. Reference the format in `docs/chats-share-data-format.md`.

**Prompt template:**
```
Convert this OpenClaw session into chats-share format. **Do not modify the original content, only perform the format conversion**.

Reference format: See docs/chats-share-data-format.md

Session content:

[The processed text is here]
```

### Phase 3: Format & Metadata

Based on processed content, generate proper format:

```markdown
---
title: {suggested title}
date: {YYYY-MM-DD}
sessionId: {session-id}
channel: {discord/telegram/etc}
model: {model-name}
totalMessages: {count}
visibility: public
description: {brief description}
participants:
  {name1}:
    role: human
  {name2}:
    role: agent
    model: {model}
---

# {Title}

> {YYYY-MM-DD}

---

**{role}** · {timestamp}

{content}
```

### Phase 4: Review & Confirm

6. Digest summary from parsed file, suggest topic name based on content
7. Confirm participants: Show the `participants` frontmatter and ask user if they want to customize display names
8. Confirm with user: show preview, ask to confirm or modify topic name
9. Rename: `mv {temp} {projectDir}/chats/{YYYYMMDD}-{topic}.md`
10. Redact sensitive info (see "Redact" section below)

### Phase 5: Branch & Push

11. Create a feature branch:
    ```bash
    cd {projectDir}
    git checkout -b docs/add-{topic}
    ```
12. Confirm with user before commit: `git add {projectDir}/chats/{topic}.md && git commit -m "docs: add {topic}"`
13. Confirm with user before push: `git push -u origin docs/add-{topic}`

## Reference Format

See `docs/chats-share-data-format.md` in the openclaw-chats-share project for the complete format specification.

Key elements:
- Frontmatter with title, date, sessionId, channel, model, participants
- `:::{type=thinking,collapsed=true}...:::` for thinking blocks
- `:::{type=error,collapsed=false}...:::` for errors
- `:::{type=custom,collapsed=true}...:::` for custom events
- `:::{type=session,collapsed=true}...:::` for session events

## First Time Setup

Run once to initialize project:
```bash
cd ~/projects
git clone git@github.com:imyelo/vibe.git
cd vibe
bun install
bun run build
```

After setup, register project in TOOLS.md:
```bash
# Append to ~/.openclaw/workspace/TOOLS.md
echo -e "\n## chats-share\n\n- Project: ~/projects/vibe\n- Site: https://lambda610.github.io\n" >> ~/.openclaw/workspace/TOOLS.md
```

## Redact

When sharing publicly, review and redact:
- API keys, tokens, passwords
- File paths with usernames (`/Users/xxx` → `~`)
- Email addresses, phone numbers
- Internal URLs and private IPs

## Output

- File: `{projectDir}/chats/{YYYYMMDD}-{topic}.md`
- URL: `{site}/chats/{slug}`

## Dev

Run local dev server:
```bash
cd {projectDir}
bun run dev
```
