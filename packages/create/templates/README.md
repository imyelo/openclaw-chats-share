# my-chats-project

Share your Openclaw conversations as a static site.

## Setup

```bash
bun install
bun run dev
```

## Commands

| Command | Action |
| --- | --- |
| `bun run dev` | Start local dev server |
| `bun run build` | Build static site to `dist/` |

Deployment is automatic — push to `main` and GitHub Actions handles the build and publish.

## Configuration

Edit `chats-share.toml` to customise the site URL, base path, and appearance (title, subtitle, footer, etc.).

For a full list of options and advanced configuration (custom domain, external chats directory, etc.), see the [openclaw-chats-share documentation](https://github.com/imyelo/openclaw-chats-share#configuration).

---

Powered by [openclaw-chats-share](https://github.com/imyelo/openclaw-chats-share).
