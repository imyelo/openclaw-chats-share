import { memo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { AVATAR_COLORS, COLLAPSIBLE_STYLE } from '../constants/index.js'
import styles from './CollapsibleMessage.module.css'

function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

// Internal MessageHeader — React-only, used exclusively by CollapsibleMessage.
// The Astro version (MessageHeader.astro) serves all static render sites.
function MessageHeader({
  author,
  timestamp,
  isFirstInGroup,
  avatarColorIndex,
}: {
  author?: string
  timestamp?: string
  isFirstInGroup?: boolean
  avatarColorIndex?: number
}) {
  if (!author || !timestamp) {
    return null
  }

  const authorLower = author.toLowerCase()
  const isAgent = authorLower.includes('agent') || authorLower.includes('assistant')

  let avatarStyle: { bg: string; text: string } | null = null
  if (avatarColorIndex !== undefined) {
    avatarStyle = AVATAR_COLORS[avatarColorIndex % AVATAR_COLORS.length]
  }

  return (
    <div
      className={cn(styles.messageHeader, !isFirstInGroup && styles.hiddenHeader)}
      data-header="true"
    >
      <div
        className={cn(styles.avatar, isAgent ? styles.avatarAgent : styles.avatarUser)}
        style={avatarStyle ? { backgroundColor: avatarStyle.bg, color: avatarStyle.text } : undefined}
      >
        {author.charAt(0).toUpperCase()}
      </div>
      <span className={styles.authorName}>{author}</span>
      <span
        className={styles.authorTimestamp}
        title={timestamp}
      >
        {timestamp.split(' ').pop()}
      </span>
    </div>
  )
}

export const CollapsibleMessage = memo(function CollapsibleMessage({
  type,
  icon,
  label,
  collapsed = false,
  content,
  author,
  timestamp,
  isFirstInGroup,
  isLastInGroup,
  avatarColorIndex,
}: {
  type: string
  icon: string
  label: string
  collapsed?: boolean
  content: string
  author?: string
  timestamp?: string
  isFirstInGroup?: boolean
  isLastInGroup?: boolean
  avatarColorIndex?: number
}) {
  const [isOpen, setIsOpen] = useState(!collapsed)

  return (
    <article
      data-author={author}
      className={cn(
        // global-collapsible-message: CSS hook used by [slug].astro to batch-hide
        // all directive messages via body.hide-collapsible-messages.
        'global-collapsible-message',
        styles.collapsible,
        isLastInGroup ? styles.collapsibleLastInGroup : styles.collapsibleNotLastInGroup,
        !isFirstInGroup && styles.collapsibleNotFirstInGroup
      )}
    >
      <MessageHeader
        author={author}
        timestamp={timestamp}
        isFirstInGroup={isFirstInGroup}
        avatarColorIndex={avatarColorIndex}
      />
      <div className={styles.collapsibleWrapper}>
        <div className={styles.collapsibleBorder}>
          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            className={styles.collapsibleToggle}
            style={{ color: COLLAPSIBLE_STYLE.accent }}
          >
            {icon && <span className={styles.collapsibleTypeIcon} style={{ backgroundColor: COLLAPSIBLE_STYLE.iconBg }}>{icon}</span>}
            <span className={styles.collapsibleTypeLabel}>{label}</span>
            <span className={styles.chevronWrapper}>
              <svg
                className={cn(styles.chevron, isOpen && styles.chevronOpen)}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                role="img"
                aria-label={isOpen ? 'Collapse' : 'Expand'}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="m6 9 6 6 6-6"
                />
              </svg>
            </span>
          </button>
          <div
            className={cn(
              styles.collapsibleContent,
              isOpen ? styles.collapsibleContentOpen : styles.collapsibleContentClosed
            )}
          >
            {/* .collapsibleBody is the grid item — no padding so it collapses to true 0.
                Padding lives in the inner wrapper to avoid the "blank space" artifact. */}
            <div className={styles.collapsibleBody}>
              <div className={cn(styles.collapsibleBodyInner, styles.prose)}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  urlTransform={(url: string) => url}
                >
                  {content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
})
