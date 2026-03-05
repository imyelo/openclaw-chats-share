# create-openclaw-chats-share

Scaffolding tool to initialize a new [openclaw-chats-share](https://github.com/imyelo/openclaw-chats-share) project.

## Usage

```bash
npx create-openclaw-chats-share <project-name>
```

This creates a new directory with:

- `chats-share.toml` — site configuration (fill in your `site` URL)
- `chats/` — directory for your exported chat YAML files
- `.github/workflows/` — GitHub Actions workflow for automatic Pages deployment
- `package.json` — wired to `openclaw-chats-share-web` for local dev and build

## Next Steps

After scaffolding, follow the setup guide in the [Chats-share README](https://github.com/imyelo/openclaw-chats-share) or paste this into your agent chat:

```
Read https://clawhub.ai/imyelo/chats-share and install the chats-share skill,
then run first-time setup for me.
```
