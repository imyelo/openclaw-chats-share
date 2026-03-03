/**
 * Shared constants for chats-share
 */

// ============================================================================
// Message Type Color Mapping (for UI) - Using inline style values
// ============================================================================

export const SPEC_COLOR_MAP: Record<string, { borderColor: string; color: string }> = {
  // Message types
  thinking_level_change: {
    borderColor: '#6b7280',
    color: '#9ca3af',
  },
  error: {
    borderColor: '#ef4444',
    color: '#f87171',
  },
  session: {
    borderColor: '#10b981',
    color: '#34d399',
  },
  custom: {
    borderColor: '#6b7280',
    color: '#9ca3af',
  },
  // Fallback colors (manual color prop)
  gray: { borderColor: '#6b7280', color: '#9ca3af' },
  green: { borderColor: '#10b981', color: '#34d399' },
  red: { borderColor: '#ef4444', color: '#f87171' },
  default: { borderColor: '#6b7280', color: '#9ca3af' },
}

// Collapsible message style - single neutral style for all process message types
export const COLLAPSIBLE_STYLE = {
  accent: '#9ca3af',
  hoverBg: 'rgba(107, 114, 128, 0.1)',
  iconBg: 'rgba(107, 114, 128, 0.15)',
}

// ============================================================================
// Message Type Info (for Markdown)
// ============================================================================

export interface MessageTypeInfo {
  icon: string
  label: string
  collapsible: boolean
  defaultOpen: boolean
}

export const MESSAGE_TYPE_INFO: Record<string, MessageTypeInfo> = {
  thinking_level_change: {
    icon: '🧠',
    label: 'Thinking Level Changed',
    collapsible: true,
    defaultOpen: false,
  },
  custom: {
    icon: '⚙️',
    label: 'System Event',
    collapsible: true,
    defaultOpen: false,
  },
  session: {
    icon: '🆕',
    label: 'Session Started',
    collapsible: true,
    defaultOpen: false,
  },
  error: {
    icon: '❌',
    label: 'Error',
    collapsible: true,
    defaultOpen: false,
  },
}

export function getMessageTypeInfo(messageType?: string): MessageTypeInfo {
  return (
    MESSAGE_TYPE_INFO[messageType ?? ''] ?? {
      icon: '',
      label: '',
      collapsible: false,
      defaultOpen: true,
    }
  )
}

// ============================================================================
// Avatar Color Pool (Professional/Muted Style)
// ============================================================================

export const AVATAR_COLORS: Array<{ bg: string; text: string }> = [
  { bg: '#3b4a5a', text: '#e8eaed' }, // deep blue-gray
  { bg: '#4a3b5a', text: '#e8dae8' }, // deep purple-gray
  { bg: '#3b5a4a', text: '#e8ede8' }, // deep green-gray
  { bg: '#5a4b3a', text: '#ece8e4' }, // deep brown-gray
  { bg: '#5a3b4a', text: '#f5e8e8' }, // deep red-gray
  { bg: '#4a5a3b', text: '#e8f0e8' }, // deep olive-gray
]
