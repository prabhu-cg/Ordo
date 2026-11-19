import { useNavigate, useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { toStorageError } from '@/storage'
import { useWorkspaceStore } from '@/store/workspace-store'

function Tree({ rows }: { rows: { depth: 0 | 1 | 2; kind: string; text: string }[] }) {
  return (
    <ul className="divide-y rounded-input border bg-card">
      {rows.map((r) => (
        <li
          key={r.text}
          className="flex items-baseline gap-3 py-2.5 pr-4"
          style={{ paddingLeft: `${1 + r.depth * 1.5}rem` }}
        >
          <span className="w-24 shrink-0 text-label font-semibold text-muted-foreground">
            {r.kind}
          </span>
          <span className="text-body text-foreground">{r.text}</span>
        </li>
      ))}
    </ul>
  )
}

function ScoreExample() {
  const rows = [
    {
      name: 'Landing page and waitlist',
      impact: 'High',
      effort: 'Low',
      confidence: 'Committed',
      verdict: 'Quick win',
    },
    {
      name: 'Public launch',
      impact: 'High',
      effort: 'Low',
      confidence: 'Exploring',
      verdict: 'Quick win, but not yet decided',
    },
    {
      name: 'Self-serve billing',
      impact: 'High',
      effort: 'High',
      confidence: 'Tentative',
      verdict: 'Major project',
    },
  ]
  return (
    <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-input border text-left text-body">
      <caption className="sr-only">Example scores</caption>
      <thead className="bg-surface">
        <tr>
          {['Initiative', 'Impact', 'Effort', 'Confidence', 'On the matrix'].map((h, i) => (
            <th
              key={h}
              scope="col"
              className={cn(
                'border-b px-3 py-2 text-label font-semibold text-muted-foreground',
                i === 99 && 'text-right',
              )}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-card">
        {rows.map((r) => (
          <tr key={r.name}>
            <th scope="row" className="border-b px-3 py-2.5 font-medium text-foreground">
              {r.name}
            </th>
            <td className="border-b px-3 py-2.5">{r.impact}</td>
            <td className="border-b px-3 py-2.5">{r.effort}</td>
            <td className="border-b px-3 py-2.5">{r.confidence}</td>
            <td className="border-b px-3 py-2.5 text-foreground">{r.verdict}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const STEPS = [
  {
    title: 'Objectives',
    summary: 'The outcomes you want.',
    body: [
      'An objective says what should be true when things go well. It is an outcome, not a thing you will build.',
      'Keep a few. Two or three objectives make a plan; ten make a wish list.',
    ],
    example: (
      <Tree
        rows={[
          { depth: 0, kind: 'Objective', text: 'Find the first 25 people who care' },
          { depth: 0, kind: 'Objective', text: 'Ship a first version people can try' },
        ]}
      />
    ),
  },
  {
    title: 'Initiatives',
    summary: 'The bets that move an objective.',
    body: [
      'An initiative is a chunk of work big enough to plan around, chosen because you believe it will move an objective.',
      'Each initiative belongs to an objective, so you can always answer why it is on the plan.',
    ],
    example: (
      <Tree
        rows={[
          { depth: 0, kind: 'Objective', text: 'Find the first 25 people who care' },
          { depth: 1, kind: 'Initiative', text: 'Landing page and waitlist' },
          { depth: 1, kind: 'Initiative', text: 'Private beta with ten users' },
        ]}
      />
    ),
  },
  {
    title: 'Features',
    summary: 'The pieces that make an initiative real.',
    body: [
      'Features are the parts you would actually build or ship. Break an initiative down until each part is small enough to finish.',
      'Features can wait until an initiative is close. You do not need to list everything up front.',
    ],
    example: (
      <Tree
        rows={[
          { depth: 0, kind: 'Initiative', text: 'Landing page and waitlist' },
          { depth: 1, kind: 'Feature', text: 'One-screen landing page' },
          { depth: 1, kind: 'Feature', text: 'Email sign-up' },
        ]}
      />
    ),
  },
  {
    title: 'Prioritisation',
    summary: 'Decide what goes first.',
    body: [
      'Rate each item low, medium or high for impact and for effort, and say how confident you are: exploring, tentative or committed. The Prioritise page plots them as quick wins, major projects, fill-ins and things to reconsider.',
      'The matrix is a guide, not a formula. It never changes an item’s priority, and you can place any item by hand.',
    ],
    example: <ScoreExample />,
  },
  {
    title: 'Roadmap views',
    summary: 'One plan, three ways to see it.',
    body: [
      'Now, next, later groups work by when you will get to it. The timeline lays it across months. The board groups it by status.',
      'All three read the same records, so changing the plan once updates every view.',
    ],
    example: (
      <p className="text-body">
        <Link
          to="/app/example"
          className="font-semibold text-primary-text underline underline-offset-4 hover:text-foreground"
        >
          See all three on the example roadmap
        </Link>
        . It is read-only and never changes your own products. When you are ready, make your own
        from the Roadmaps page.
      </p>
    ),
  },
]

export function OnboardingPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { onboarding, setOnboarding } = useWorkspaceStore()
  const raw = Number(params.get('step'))
  const index = Number.isInteger(raw) && raw >= 1 && raw <= STEPS.length ? raw - 1 : 0
  const step = STEPS[index]!
  const last = index === STEPS.length - 1

  const go = (n: number) => setParams({ step: String(n + 1) }, { replace: false })
  async function leave(status: 'skipped' | 'completed') {
    try {
      await setOnboarding(status)
    } catch (e) {
      toast.error('Could not save your choice', toStorageError(e).message)
    }
    navigate('/app')
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <PageHeader
        title="A quick guide to Ordo"
        description="Five short steps on how a plan fits together. You can skip it now and come back any time from the sidebar."
      />

      <nav aria-label="Guide progress">
        <ol className="flex flex-wrap gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === index ? 'step' : undefined}
                className={cn(
                  'rounded-full px-3 py-1.5 text-body font-medium transition-colors',
                  i === index
                    ? 'bg-primary-soft font-semibold text-primary-text'
                    : 'text-muted-foreground hover:bg-sand hover:text-foreground',
                )}
              >
                <span className="tabular-nums">{i + 1}</span>
                <span className="sr-only">. </span>
                <span className="ml-1.5 hidden sm:inline">{s.title}</span>
                <span className="sr-only sm:hidden">{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section aria-labelledby="step-title" className="flex flex-col gap-5">
        <p className="text-caption text-muted-foreground tabular-nums">
          Step {index + 1} of {STEPS.length}
        </p>
        <h2 id="step-title" tabIndex={-1} className="-mt-3 text-3xl outline-none">
          {step.title}
        </h2>
        <p className="text-title font-semibold text-foreground">{step.summary}</p>
        {step.body.map((p) => (
          <p key={p} className="max-w-prose text-[0.9375rem] leading-7">
            {p}
          </p>
        ))}
        <div className="mt-1">{step.example}</div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <Button
          variant="ghost"
          onClick={() => (onboarding ? navigate('/app') : void leave('skipped'))}
        >
          {onboarding ? 'Close guide' : 'Skip guide'}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0}>
            Back
          </Button>
          {last ? (
            <Button variant="primary" onClick={() => void leave('completed')}>
              Finish
            </Button>
          ) : (
            <Button variant="primary" onClick={() => go(index + 1)}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
