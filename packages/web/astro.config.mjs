import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import UnoCSS from 'unocss/astro';
import { loadConfig } from 'c12';
import { createDefu } from 'defu';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { ChatsShareConfigSchema } from './src/lib/config-schema.ts';

// Arrays are concatenated, then base items.
const merge = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key])) {
    obj[key] = [...obj[key], ...value];
    return true;
  }
});

const projectDir = process.env.CHATS_SHARE_WORKDIR ?? process.cwd();

// The chats/ directory lives outside Astro's project root, so Vite won't watch
// it by default. This plugin adds it to the watcher and triggers a full reload
// whenever a chat file or the project config file changes.
function externalWatchPlugin() {
  const chatsDir = resolve(
    projectDir,
    config.chats_dir ?? 'chats',
  );
  const configDir = projectDir;

  return {
    name: 'openclaw-chats-watch',
    apply: 'serve',
    configureServer(server) {
      if (existsSync(chatsDir)) {
        server.watcher.add(chatsDir);
      }
      server.watcher.add(join(configDir, 'chats-share.toml'));

      const reload = (file) => {
        if (file.startsWith(chatsDir) || file.startsWith(join(configDir, 'chats-share.toml'))) {
          server.moduleGraph.invalidateAll();
          server.ws.send({ type: 'full-reload' });
        }
      };

      server.watcher.on('add', reload);
      server.watcher.on('change', reload);
      server.watcher.on('unlink', reload);
    },
  };
}

const { config: projectConfig } = await loadConfig({
  name: 'chats-share',
  configFile: 'chats-share',
  cwd: projectDir,
});

const parsed = ChatsShareConfigSchema.safeParse(projectConfig);
if (!parsed.success) {
  console.warn('Invalid config:', parsed.error.flatten());
}

const config = parsed.success ? parsed.data : {};

// Map top-level convenience keys to Astro config options.
// Paths are resolved against the project directory so they work regardless
// of which directory Astro is launched from.
const mapped = {};
if (config.site) mapped.site = config.site;
if (config.base) mapped.base = config.base;
if (config.public_dir) mapped.publicDir = projectDir ? join(projectDir, config.public_dir) : config.public_dir;
if (config.out_dir) mapped.outDir = projectDir ? join(projectDir, config.out_dir) : config.out_dir;

export default defineConfig(merge(
  { ...mapped, ...(config.astro ?? {}) },
  {
    integrations: [
      UnoCSS({ injectReset: true }),
      react(),
    ],
    vite: {
      css: {
        modules: {
          generateScopedName: "[name]__[local]___[hash:base64:5]",
        },
      },
      plugins: [externalWatchPlugin()],
    },
    output: 'static',
    build: {
      format: 'directory',
    },
  },
));
