export type CardField =
  'priority' | 'confidence' | 'owner' | 'dates' | 'tags' | 'objective' | 'impact' | 'effort'
export const CARD_FIELD_LABELS: Record<CardField, string> = {
  priority: 'Priority',
  confidence: 'Confidence',
  owner: 'Owner',
  dates: 'Dates',
  tags: 'Tags',
  objective: 'Objective',
  impact: 'Impact',
  effort: 'Effort',
}
export const DEFAULT_CARD_FIELDS: CardField[] = ['priority', 'confidence', 'owner', 'dates']
