import type { APIRoute } from 'astro'
import { type ChatWithContent, getAllChatsWithContent } from '../../../lib/chats.js'
import { getProjectConfig } from '../../../lib/config.js'
import { buildSvgBase, escapeXml, SVG_THEME, wrapText } from '../../../lib/svg-utils.js'

export async function getStaticPaths() {
  const chats = await getAllChatsWithContent()
  return chats.map(chat => ({ params: { slug: chat.slug }, props: { chat } }))
}

export const GET: APIRoute = async ({ props }) => {
  const { chat } = props as { chat: ChatWithContent }
  const config = await getProjectConfig()
  const siteTitle = config.template?.options?.title || 'chats-share'

  return new Response(buildTextCard(chat, siteTitle), {
    headers: { 'Content-Type': 'image/svg+xml' },
  })
}

function buildTextCard(chat: ChatWithContent, siteTitle: string): string {
  const W = 1200
  const H = 630
  const PAD = 72
  const { textColor, mutedColor, accentColor } = SVG_THEME

  const titleLines = wrapText(chat.title || 'Untitled', 38, 3)
  const lineHeight = 52
  const titleY = 200

  const metaParts: string[] = []
  if (chat.channel) {
    metaParts.push(escapeXml(chat.channel))
  }
  if (chat.model) {
    metaParts.push(escapeXml(chat.model))
  }
  if (chat.date) {
    metaParts.push(escapeXml(chat.date))
  }
  const metaLine = metaParts.join('  ◆  ')

  const titleSvg = titleLines
    .map(
      (line, i) =>
        `<text x="${PAD + 18}" y="${titleY + i * lineHeight}" font-family="monospace" font-size="40" font-weight="500" fill="${textColor}">${escapeXml(line)}</text>`
    )
    .join('\n  ')

  const metaY = titleY + titleLines.length * lineHeight + 32

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${buildSvgBase(W, H)}

  <!-- Title lines -->
  ${titleSvg}

  <!-- Meta line -->
  <text x="${PAD + 18}" y="${metaY}" font-family="monospace" font-size="22" fill="${mutedColor}">${metaLine}</text>

  <!-- Site name (bottom-right) -->
  <text x="${W - PAD}" y="${H - PAD}" text-anchor="end" font-family="monospace" font-size="20" fill="${accentColor}">// ${escapeXml(siteTitle)}</text>
</svg>`
}
