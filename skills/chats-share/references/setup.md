# First-Time Setup

Run once to initialize a chats-share project.

## 1. Create Project

```bash
npx create-openclaw-chats-share
```

This sets up the project structure (git repo, `chats-share.toml`, `chats/` directory).

## 2. Register with Your Agent

Follow the **Registration** section in your agent profile:

| Agent | Profile |
|-------|---------|
| OpenClaw | [platforms/openclaw.md](platforms/openclaw.md#registration) |

For unlisted agents: note the absolute project path and provide it manually when running the skill.

## 3. Verify

Confirm `{projectDir}/chats-share.toml` has a `site` URL set.
