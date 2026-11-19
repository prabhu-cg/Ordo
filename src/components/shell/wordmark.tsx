import { cn } from '@/lib/utils'
import { LogoMark } from './logo-mark'

export const TAGLINE = 'Plan better. Build smarter'

/** The Ordo mark beside the name set in the display serif, with an optional tagline below. */
export function Wordmark({
  className,
  tagline = false,
}: {
  className?: string
  tagline?: boolean
}) {
  return (
    <div className={cn('flex flex-col', className)}>
      <span className="flex items-center gap-2 text-foreground">
        <LogoMark />
        <span className="font-display text-[1.75rem] leading-none">Ordo</span>
      </span>
      {tagline && <span className="mt-1.5 text-caption text-muted-foreground">{TAGLINE}</span>}
    </div>
  )
}
