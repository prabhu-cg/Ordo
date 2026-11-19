import { useEffect } from 'react'

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Ordo` : 'Ordo — Plan better. Build smarter'
  }, [title])
}
