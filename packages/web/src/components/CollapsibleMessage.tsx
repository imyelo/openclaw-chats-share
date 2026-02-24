import { memo, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { AVATAR_COLORS, COLLAPSIBLE_TYPE_STYLES, SPEC_COLOR_MAP } from '../constants/index.js'
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
  if (!isFirstInGroup || !author || !timestamp) {
    return null
  }

  const authorLower = author.toLowerCase()
  const isAgent = authorLower.includes('agent') || authorLower.includes('assistant')

  let avatarStyle: { bg: string; text: string } | null = null
  if (avatarColorIndex !== undefined) {
    avatarStyle = AVATAR_COLORS[avatarColorIndex % AVATAR_COLORS.length]
  }

  return (
    <div className={styles.messageHeader}>
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
  collapsed = true,
  color,
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
  color?: string
  content: string
  author?: string
  timestamp?: string
  isFirstInGroup?: boolean
  isLastInGroup?: boolean
  avatarColorIndex?: number
}) {
  const [isOpen, setIsOpen] = useState(!collapsed)

  const colors = useMemo(() => {
    const lookupKey = color && SPEC_COLOR_MAP[color] ? color : SPEC_COLOR_MAP[type] ? type : 'default'
    return SPEC_COLOR_MAP[lookupKey] || { borderColor: '#d4a853', color: '#d4a853' }
  }, [color, type])

  const style = useMemo(() => {
    return COLLAPSIBLE_TYPE_STYLES[type] || COLLAPSIBLE_TYPE_STYLES.thinking_level_change
  }, [type])

  return (
    <article
      className={cn(
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
        <div
          className={styles.collapsibleBorder}
          style={{ borderLeftColor: colors.borderColor }}
        >
          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            className={styles.collapsibleToggle}
            style={{ color: style.accent }}
          >
            {icon && <span className={styles.collapsibleTypeIcon}>{icon}</span>}
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
            <div className={cn(styles.collapsibleBody, styles.prose)}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
})
