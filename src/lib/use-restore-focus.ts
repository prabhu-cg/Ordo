import { useRef } from 'react'

/**
 * When a dialog or drawer closes, put focus back on whatever had it when it opened. Radix only does this for its
 * own Trigger component; ours open from ordinary buttons and from stores, so without this a keyboard user is
 * dropped at the top of the page and has to tab all the way back.
 *
 * Spread the result onto the content: `onOpenAutoFocus` notes who had focus (just before focus moves into the
 * content), and `onCloseAutoFocus` gives it back.
 */
export function useRestoreFocus(onOpen?: (event: Event) => void): {
  onOpenAutoFocus: (event: Event) => void
  onCloseAutoFocus: (event: Event) => void
} {
  const opener = useRef<Element | null>(null)
  return {
    onOpenAutoFocus: (event) => {
      opener.current = document.activeElement
      onOpen?.(event)
    },
    onCloseAutoFocus: (event) => {
      event.preventDefault()
      const el = opener.current
      if (el instanceof HTMLElement && el.isConnected && el !== document.body) el.focus()
      opener.current = null
    },
  }
}
