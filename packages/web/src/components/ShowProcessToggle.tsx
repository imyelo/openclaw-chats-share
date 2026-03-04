import { useEffect, useState } from 'react'
import styles from './ShowProcessToggle.module.css'

function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

// Header reflow: when process messages are hidden, two static ChatMessage
// articles from the same author may become adjacent, making the second one's
// header look redundant. This rescans the DOM after each visibility change to
// re-derive which headers should show.
function reflowHeaders(showProcess: boolean) {
  const articles = document.querySelectorAll<HTMLElement>('article[data-author]')
  let lastVisibleAuthor: string | null = null

  for (const article of Array.from(articles)) {
    if (!showProcess && article.dataset.collapsible === 'true') {
      continue
    }

    const header = article.querySelector<HTMLElement>('[data-header="true"]')
    if (!header) {
      continue
    }

    const author = article.getAttribute('data-author')
    if (author !== lastVisibleAuthor) {
      header.classList.remove('hidden-header')
      article.classList.remove('not-first-in-group')
    } else {
      header.classList.add('hidden-header')
      article.classList.add('not-first-in-group')
    }
    lastVisibleAuthor = author
  }
}

export function ShowProcessToggle({ defaultShow }: { defaultShow: boolean }) {
  const [showProcess, setShowProcess] = useState(defaultShow)
  const [isFlickering, setIsFlickering] = useState(false)

  // Reflow static ChatMessage headers after every visibility change.
  useEffect(() => {
    reflowHeaders(showProcess)
  }, [showProcess])

  function handleClick() {
    const next = !showProcess
    setIsFlickering(true)
    setShowProcess(next)
    document.body.classList.toggle('show-process', next)
  }

  return (
    <button
      type="button"
      className={cn(styles.toggleBtn, !showProcess && styles.toggleBtnHidden, isFlickering && styles.flickering)}
      aria-label={showProcess ? 'Hide process information' : 'Show process information'}
      aria-pressed={!showProcess}
      onAnimationEnd={() => setIsFlickering(false)}
      onClick={handleClick}
    >
      <span
        className={cn(styles.togglePip, !showProcess && styles.togglePipHidden)}
        aria-hidden="true"
      />
      <span className={styles.toggleText}>{showProcess ? 'hide process' : 'show process'}</span>
    </button>
  )
}
