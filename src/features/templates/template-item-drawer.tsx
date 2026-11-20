import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ConfidenceBadge,
  DependencyBadge,
  PriorityBadge,
  StatusBadge,
} from '@/components/domain/indicators'
import { formatDate } from '@/lib/format'
import { LEVEL_LABELS } from '@/lib/labels'
import type { Feature, Initiative } from '@/domain'
import type { StampedBundle } from '@/templates/records'
import type { LinkSummary } from '@/features/roadmap/engine'

/** A read-only look at one item of a template's sample plan. */
export function TemplateItemDrawer({
  records,
  openId,
  links,
  onClose,
}: {
  records: StampedBundle
  openId?: { kind: 'initiative' | 'feature'; id: string }
  links: Map<string, LinkSummary>
  onClose: () => void
}) {
  const item: Initiative | Feature | undefined = openId
    ? (openId.kind === 'initiative' ? records.initiatives : records.features).find(
        (x) => x.id === openId.id,
      )
    : undefined
  const parent =
    openId?.kind === 'feature'
      ? records.initiatives.find((i) => i.id === (item as Feature | undefined)?.initiativeId)
      : undefined
  const objective = records.objectives.find(
    (o) => o.id === ((item as Initiative | undefined)?.objectiveId ?? parent?.objectiveId),
  )
  const features =
    openId?.kind === 'initiative'
      ? records.features.filter((f) => f.initiativeId === openId.id)
      : []
  const dates =
    item?.startDate && item.endDate
      ? `${formatDate(item.startDate)} to ${formatDate(item.endDate)}`
      : 'No dates'

  return (
    <Drawer open={Boolean(item)} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent size="xl">
        {item && openId && (
          <>
            <DrawerHeader>
              <DrawerTitle>{item.title}</DrawerTitle>
              <DrawerDescription asChild>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={item.status} />
                  <PriorityBadge
                    priority={item.priority}
                    className={item.priority ? '' : 'hidden'}
                  />
                  <ConfidenceBadge
                    confidence={item.confidence}
                    className={item.confidence ? '' : 'hidden'}
                  />
                  <Badge variant="outline">Sample, read-only</Badge>
                </div>
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-8">
              <section aria-labelledby="t-details" className="flex flex-col gap-4">
                <h3 id="t-details" className="text-title font-semibold text-foreground">
                  Details
                </h3>
                <p className="max-w-prose text-[0.9375rem] leading-7">
                  {item.description ?? 'No description.'}
                </p>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {[
                    ['Objective', objective?.title ?? 'None'],
                    ...(parent ? [['Initiative', parent.title]] : []),
                    ['Planned', dates],
                    [
                      'Impact',
                      item.scoring?.impact ? LEVEL_LABELS[item.scoring.impact] : 'Not set',
                    ],
                    [
                      'Effort',
                      item.scoring?.effort ? LEVEL_LABELS[item.scoring.effort] : 'Not set',
                    ],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-label font-semibold text-muted-foreground">{k}</dt>
                      <dd className="text-body text-foreground tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                <DependencyBadge links={links.get(`${openId.kind}:${openId.id}`)} />
              </section>
              {features.length > 0 && (
                <section aria-labelledby="t-features">
                  <h3 id="t-features" className="text-title font-semibold text-foreground">
                    Features{' '}
                    <span className="font-normal text-muted-foreground tabular-nums">
                      {features.length}
                    </span>
                  </h3>
                  <ul className="mt-2 divide-y border-y">
                    {features.map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="text-body text-foreground">{f.title}</span>
                        <span className="flex items-center gap-1.5">
                          <PriorityBadge
                            priority={f.priority}
                            className={f.priority ? '' : 'hidden'}
                          />
                          <StatusBadge status={f.status} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
