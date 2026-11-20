import { z } from 'zod'
import { TONES, toneSchema, type Tone, type WorkStatus } from '@/domain'
import { DEFAULT_CARD_FIELDS, type CardField } from '@/features/roadmap/card-fields'

export const TONE_LABELS: Record<Tone, string> = {
  neutral: 'Grey',
  amber: 'Gold',
  info: 'Blue',
  success: 'Green',
  warning: 'Orange',
  destructive: 'Red',
}
export const TONE_ORDER: readonly Tone[] = [
  'neutral',
  'info',
  'amber',
  'success',
  'warning',
  'destructive',
]
void TONES

/**
 * How a tone looks in each place it is used. All of them are semantic tokens, never raw colours, so each tone
 * keeps its contrast in light and dark. The class names are written out in full so Tailwind can see them.
 */
export const TONE_BADGE: Record<
  Tone,
  'secondary' | 'soft' | 'info' | 'success' | 'warning' | 'destructive'
> = {
  neutral: 'secondary',
  amber: 'soft',
  info: 'info',
  success: 'success',
  warning: 'warning',
  destructive: 'destructive',
}
/** A timeline bar: a soft fill, or a solid one for work that is under way. */
export const TONE_BAR: Record<Tone, { soft: string; solid: string }> = {
  neutral: {
    soft: 'bg-secondary text-ink border-border-strong',
    solid: 'bg-ink text-background border-transparent',
  },
  amber: {
    soft: 'bg-primary-soft text-primary-text border-primary-text/40',
    solid: 'bg-primary text-primary-foreground border-transparent',
  },
  info: {
    soft: 'bg-info-soft text-info border-transparent',
    solid: 'bg-info text-background border-transparent',
  },
  success: {
    soft: 'bg-success-soft text-success border-transparent',
    solid: 'bg-success text-background border-transparent',
  },
  warning: {
    soft: 'bg-warning-soft text-warning border-transparent',
    solid: 'bg-warning text-background border-transparent',
  },
  destructive: {
    soft: 'bg-destructive-soft text-destructive border-transparent',
    solid: 'bg-destructive text-background border-transparent',
  },
}
/** A small swatch, and an accent edge for something that belongs to a roadmap. */
export const TONE_SWATCH: Record<Tone, string> = {
  neutral: 'bg-ink/50',
  amber: 'bg-primary',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
}
export const TONE_EDGE: Record<Tone, string> = {
  neutral: 'border-l-ink/50',
  amber: 'border-l-primary',
  info: 'border-l-info',
  success: 'border-l-success',
  warning: 'border-l-warning',
  destructive: 'border-l-destructive',
}

export const DEFAULT_STATUS_TONES: Record<WorkStatus, Tone> = {
  idea: 'neutral',
  planned: 'info',
  'in-progress': 'amber',
  shipped: 'success',
  paused: 'warning',
  dropped: 'destructive',
}

export const DENSITIES = ['comfortable', 'compact'] as const
export type Density = (typeof DENSITIES)[number]
export const DENSITY_LABELS: Record<Density, string> = {
  comfortable: 'Comfortable',
  compact: 'Compact',
}

const CARD_FIELD_KEYS = [
  'priority',
  'confidence',
  'dependencies',
  'owner',
  'dates',
  'tags',
  'objective',
  'impact',
  'effort',
] as const

const WORK_STATUSES = ['idea', 'planned', 'in-progress', 'shipped', 'paused', 'dropped'] as const

export const appearanceSchema = z.object({
  density: z.enum(DENSITIES).catch('comfortable'),
  statusTones: z
    .record(z.string(), toneSchema.catch('neutral'))
    .catch({})
    .transform(
      (r) =>
        Object.fromEntries(
          WORK_STATUSES.map((s) => [s, r[s] ?? DEFAULT_STATUS_TONES[s]]),
        ) as Record<WorkStatus, Tone>,
    ),
  /** The details shown on a card unless a board has been set up differently. */
  cardFields: z
    .array(z.enum(CARD_FIELD_KEYS))
    .catch([...DEFAULT_CARD_FIELDS])
    .transform((f) => [...new Set(f)] as CardField[]),
})
export type Appearance = z.infer<typeof appearanceSchema>

export const DEFAULT_APPEARANCE: Appearance = {
  density: 'comfortable',
  statusTones: { ...DEFAULT_STATUS_TONES },
  cardFields: [...DEFAULT_CARD_FIELDS],
}

/** Read saved settings. Anything missing or damaged falls back to the default, so a bad value cannot break the app. */
export function parseAppearance(raw: unknown): Appearance {
  const parsed = appearanceSchema.safeParse(raw && typeof raw === 'object' ? raw : {})
  return parsed.success ? parsed.data : { ...DEFAULT_APPEARANCE }
}
