import { cn } from '@/lib/utils'

/** A measured quantity from 0 to 100. Amber is a fill, so it carries progress; the number carries the meaning. */
export function Progress({
  value,
  label,
  className,
}: {
  value: number
  label: string
  className?: string
}) {
  const pct = Math.min(100, Math.max(0, Math.round(value)))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
