import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import UnoCSS from 'unocss/astro';
import { loadConfig } from 'c12';
import { createDefu } from 'defu';
import { join } from 'node:path';
import { ChatsShareConfigSchema } from './src/lib/config-schema.ts';

// Arrays are concatenated, then base items.
const merge = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key])) {
    obj[key] = [...obj[key], ...value];
    return true;
  }
});

const projectDir = process.env.CHATS_SHARE_WORKDIR;

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
    },
    output: 'static',
    build: {
      format: 'directory',
    },
  },
));
