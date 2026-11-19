import { cn } from '@/lib/utils'

export const TAGLINE = 'Plan better. Build smarter'

/** Text wordmark for now: Ordo set in the display serif. Swap for a mark once one exists. */
export function Wordmark({
  className,
  tagline = false,
}: {
  className?: string
  tagline?: boolean
}) {
  return (
    <div className={cn('flex flex-col', className)}>
      <span className="font-display text-[1.75rem] leading-none text-foreground">Ordo</span>
      {tagline && <span className="mt-1.5 text-caption text-muted-foreground">{TAGLINE}</span>}
    </div>
  )
}
