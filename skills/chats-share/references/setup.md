# Setup

---

## First-Time Setup

Run once to create a brand-new chats-share project.

### 1. Ask for a Repository Name

Ask the user what to name their chats-share repository (e.g. `my-chats`). Use this name as `{repoName}` throughout the steps below.

### 2. Create a Private GitHub Repository

```bash
gh repo create {repoName} --private
```

Note the resulting `{owner}/{repoName}` for later steps.

### 3. Scaffold the Project

```bash
npx create-openclaw-chats-share {repoName}
cd {repoName}
```

This creates a git repo with `chats-share.toml`, a `chats/` directory, and a GitHub Actions workflow for Pages deployment.

### 4. Configure the Site URL

Edit `chats-share.toml` and set:

```toml
site = "https://{owner}.github.io"
base = "/{repoName}"
```

Also set `[template.options]` title/subtitle if the user wants custom branding.

### 5. Push to GitHub

```bash
git remote add origin https://github.com/{owner}/{repoName}.git
git push -u origin main
```

### 6. Enable GitHub Actions as the Pages Source

```bash
gh api repos/{owner}/{repoName}/pages --method POST -f build_type=workflow
```

If this fails (e.g. Pages not yet initialized), guide the user to enable it manually:
**Settings → Pages → Source → GitHub Actions**

### 7. Register with Your Agent

→ See [Register & Verify](#register--verify) below.

---

## Existing Repo, New Environment

Use this when a chats-share repo already exists on GitHub but hasn't been registered on the current machine yet.

### 1. Ask for the Repo

Ask the user for their existing chats-share GitHub repo (e.g. `your-username/my-chats`) and where they'd like to clone it locally.

### 2. Clone the Repo

```bash
git clone https://github.com/{owner}/{repoName}.git {localDir}
cd {localDir}
```

### 3. Verify Configuration

Check that `chats-share.toml` already has `site` set. If it's missing or empty, ask the user for their GitHub Pages URL and fill it in.

### 4. Register with Your Agent

→ See [Register & Verify](#register--verify) below.

---

## Register & Verify

Follow the **Registration** section in your agent profile:

| Agent | Profile |
|-------|---------|
| OpenClaw | [platforms/openclaw.md](platforms/openclaw.md#registration) |
| _(others)_ | [platforms/unknown.md](platforms/unknown.md#registration) — provide project path manually |

Then confirm `{projectDir}/chats-share.toml` has `site` set and the agent profile lists the correct project path.
