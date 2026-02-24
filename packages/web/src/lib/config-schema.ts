import { z } from 'zod'

const TemplateOptionsSchema = z.object({
  footer: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
})

const TemplateSchema = z.object({
  options: TemplateOptionsSchema.optional(),
})

export const ChatsShareConfigSchema = z.object({
  site: z.string().url().optional(),
  base: z.string().optional(),
  public_dir: z.string().optional(),
  out_dir: z.string().optional(),
  chats_dir: z.string().optional(),
  template: TemplateSchema.optional(),
})

export type ChatsShareConfig = z.infer<typeof ChatsShareConfigSchema>
