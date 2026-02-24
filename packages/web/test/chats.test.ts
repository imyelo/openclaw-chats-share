import { describe, expect, it } from 'bun:test'
import { splitMessageBlocks } from '../src/lib/chats'

describe('splitMessageBlocks', () => {
  it('should split by --- when not in fenced block (with frontmatter)', () => {
    // Real markdown format with frontmatter
    // After slice(1), first block is title+date, then message blocks
    const content = `---
title: "test"
date: "2026-01-01"
---

# title

> date

---

**user** · timestamp

Hello

---

**assistant** · timestamp

Response`

    const blocks = splitMessageBlocks(content)
    // First block after slice(1) is "# title\n\n> date"
    // Then "**user**..." block
    // Then "**assistant**..." block
    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toContain('# title')
    expect(blocks[1]).toContain('**user**')
    expect(blocks[2]).toContain('Response')
  })

  it('should NOT split --- inside :::{...} fenced blocks', () => {
    const content = `---
title: "test"
---

# title

---

**assistant** · timestamp

:::{type=custom,collapsed=true}
🔧 **read** · /path/to/file.md
✅ **read** · # OpenClaw Chat Share Tool

**Date**: 2026-02-18

---

## Core Idea

Content here

:::

---

**assistant** · timestamp

Next message`

    const blocks = splitMessageBlocks(content)
    // After slice(1): # title, assistant+custom block, next assistant
    expect(blocks).toHaveLength(3)

    // Block 1 should contain the read tool result with --- inside
    expect(blocks[1]).toContain('🔧 **read**')
    expect(blocks[1]).toContain('## Core Idea')
    // Should NOT be split
    expect(blocks[1]).not.toContain('Next message')
  })

  it('should handle multiple fenced blocks', () => {
    const content = `---
title: "test"
---

# title

---

:::{type=custom}
block1 content

---

more content
:::

---

:::{type=thinking}
block2
:::

---

**user** · timestamp

Hello`

    const blocks = splitMessageBlocks(content)
    // blocks[0] = # title
    // blocks[1] = fenced block 1
    // blocks[2] = fenced block 2
    // blocks[3] = user message
    expect(blocks).toHaveLength(4)
    expect(blocks[1]).toContain('block1 content')
    expect(blocks[1]).toContain('more content')
    expect(blocks[2]).toContain('block2')
  })

  it('should handle thinking blocks with --- inside', () => {
    const content = `---
title: "test"
---

# title

---

**assistant** · timestamp

:::{type=thinking_level_change,collapsed=true}
🧠 **Thinking**

Line 1

---

Line 2

:::

---

**user** · timestamp

Hello`

    const blocks = splitMessageBlocks(content)
    // blocks[0] = # title
    // blocks[1] = thinking block with --- inside
    // blocks[2] = user message
    expect(blocks).toHaveLength(3)
    expect(blocks[1]).toContain('Line 1')
    expect(blocks[1]).toContain('Line 2')
  })

  it('should handle empty content', () => {
    const blocks = splitMessageBlocks('')
    expect(blocks).toHaveLength(0)
  })

  it('should handle content without separators', () => {
    const content = `---
title: "test"
---

# title

**user** · timestamp

Hello`

    const blocks = splitMessageBlocks(content)
    // blocks[0] = # title + user message (no --- separator)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toContain('Hello')
  })

  it('should handle --- at the start', () => {
    const content = `---
title: "test"
---

# title

---

**user** · timestamp

Hello`

    const blocks = splitMessageBlocks(content)
    // blocks[0] = # title
    // blocks[1] = user message
    expect(blocks).toHaveLength(2)
    expect(blocks[1]).toContain('Hello')
  })

  it('should preserve tool result content with markdown headers', () => {
    // This is the real-world case from test1.md
    const content = `---
title: "test"
---

# title

---

**assistant** · 2026-02-18T08:19:39.190Z

:::{type=thinking_level_change,collapsed=true}
🧠 **Thinking**
Yelo is asking where the foobar was saved.
:::

Just wrote to \`/tmp/foobar.md\`

Let me also update the confirmed requirements:


:::{type=custom,collapsed=true}
🔧 **read** · /tmp/foobar.md
✅ **read** · # OpenClaw Chat Share Tool

**Date**: 2026-02-18
**Tags**: [OpenClaw, Tool, Share, Discord]

---

## Core Idea

OpenClaw chat records from external channels are difficult to share.

---

## Confirmed Requirements

- **UI**: Simple conversation UI, not intentionally mimicking Discord/Telegram

:::


---

**assistant** · 2026-02-18T08:19:46.179Z

Next message`

    const blocks = splitMessageBlocks(content)
    // After slice(1): # title, assistant with thinking+read tool, next assistant
    expect(blocks).toHaveLength(3)

    // The read tool result should NOT be split by --- inside it
    expect(blocks[1]).toContain('🔧 **read**')
    expect(blocks[1]).toContain('## Core Idea')
    expect(blocks[1]).toContain('## Confirmed Requirements')
    expect(blocks[1]).not.toContain('Next message')
  })
})
