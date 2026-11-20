type Props = Record<string, unknown> & { ref?: (node: HTMLElement | null) => void }

/**
 * The drag library hands over one bundle for "the thing you grab". A card wants it in two places: the event
 * listeners on the whole card, so it can be grabbed anywhere, and the role, focus and labelling on the title alone,
 * so the one focusable element is named by exactly the text it shows. (A button named differently from the words
 * on it fails "label in name", and speech-control users cannot say what they see.)
 */
export function splitHandle(handle?: Props) {
  const { ref, ...rest } = handle ?? {}
  const entries = Object.entries(rest)
  return {
    ref,
    listeners: Object.fromEntries(entries.filter(([k]) => k.startsWith('on'))),
    attributes: Object.fromEntries(entries.filter(([k]) => !k.startsWith('on'))),
  }
}
