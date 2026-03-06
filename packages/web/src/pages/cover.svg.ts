import type { APIRoute } from 'astro'
import { getProjectConfig } from '../lib/config.js'
import { buildSvgBase, escapeXml, SVG_THEME } from '../lib/svg-utils.js'

export const GET: APIRoute = async () => {
  const config = await getProjectConfig()
  const siteTitle = config.template?.options?.title || 'chats-share'
  const siteSubtitle = config.template?.options?.subtitle || '// openclaw conversation archive'

  return new Response(buildSiteCover(siteTitle, siteSubtitle), {
    headers: { 'Content-Type': 'image/svg+xml' },
  })
}

function buildSiteCover(title: string, subtitle: string): string {
  const W = 1200
  const H = 630
  const { textColor, mutedColor } = SVG_THEME

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${buildSvgBase(W, H)}

  <!-- Site title -->
  <text x="90" y="280" font-family="monospace" font-size="72" font-weight="500" fill="${textColor}">${escapeXml(title)}</text>

  <!-- Subtitle -->
  <text x="90" y="350" font-family="monospace" font-size="28" fill="${mutedColor}">${escapeXml(subtitle)}</text>
</svg>`
}
