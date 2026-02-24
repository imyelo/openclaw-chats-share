import { loadConfig } from 'c12'
import { type ChatsShareConfig, ChatsShareConfigSchema } from './config-schema'

let _configCache: ChatsShareConfig | null = null

export async function getProjectConfig(): Promise<ChatsShareConfig> {
  if (_configCache) {
    return _configCache
  }

  const projectDir = process.env.CHATS_SHARE_WORKDIR
  const { config } = await loadConfig<ChatsShareConfig>({
    name: 'chats-share',
    configFile: 'chats-share',
    cwd: projectDir,
  })

  const parsed = ChatsShareConfigSchema.safeParse(config)
  if (!parsed.success) {
    console.warn('Invalid config:', parsed.error.flatten())
    _configCache = {}
    return _configCache
  }

  _configCache = parsed.data || {}
  return _configCache
}
