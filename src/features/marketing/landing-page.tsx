import { Check, ChevronDown } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { RoadmapLayout, RoadmapViewer } from '@/components/roadmap/roadmap-preview'
import { Wordmark } from '@/components/shell/wordmark'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DEFAULT_SAMPLE_TEMPLATE_ID,
  TEMPLATES,
  describeTemplate,
  getTemplate,
  resolveTemplate,
} from '@/templates'
import { usePageTitle } from './use-page-title'

const container = 'mx-auto w-full max-w-6xl px-4 sm:px-6'
const band = 'py-16 sm:py-24 scroll-mt-16'

function SectionTitle({
  id,
  title,
  children,
  className,
}: {
  id: string
  title: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('max-w-2xl', className)}>
      <h2 id={id} className="text-3xl sm:text-4xl">
        {title}
      </h2>
      {children && (
        <p className="mt-3 text-[1.0625rem] leading-7 text-muted-foreground">{children}</p>
      )}
    </div>
  )
}

function Hero() {
  const bundle = useMemo(() => {
    const t = getTemplate(DEFAULT_SAMPLE_TEMPLATE_ID)!
    return resolveTemplate(t, { product: { name: t.name } })
  }, [])

  return (
    <div id="product" className="scroll-mt-16">
      <section aria-labelledby="hero-title" className="bg-surface pt-16 sm:pt-24">
        <div className={cn(container, 'flex flex-col items-center text-center')}>
          <h1 id="hero-title" className="max-w-4xl text-5xl leading-none sm:text-7xl">
            Plan your product. <span className="text-primary-text">Shape your roadmap.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Turn ideas, priorities and product goals into clear, visual roadmaps without the
            complexity of traditional product management software.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild variant="primary" size="lg">
              <Link to="/app/new">Create your roadmap</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/example">Explore an example</Link>
            </Button>
          </div>
          <p className="mt-4 text-caption text-muted-foreground">
            Free. No account. Your work stays in your browser.
          </p>
        </div>
      </section>

      <div className="relative pt-12">
        <div aria-hidden className="absolute inset-x-0 top-0 h-[38%] bg-surface" />
        <div className={cn(container, 'relative')}>
          <figure>
            <div className="device-shadow rounded-[22px] bg-[var(--device)] p-2 sm:rounded-[28px] sm:p-3.5">
              <div className="overflow-hidden rounded-[14px] bg-background sm:rounded-[16px]">
                <div className="flex items-center justify-between gap-3 border-b bg-surface px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Wordmark className="[&_.font-display]:text-xl [&_svg]:size-5" />
                    <span aria-hidden className="h-5 w-px bg-border-strong" />
                    <span className="truncate text-body font-semibold text-foreground">
                      {bundle.product.name}
                    </span>
                  </div>
                  <Badge variant="outline">Sample</Badge>
                </div>
                <div className="p-4 sm:p-8">
                  <RoadmapViewer bundle={bundle} compact />
                </div>
              </div>
            </div>
            <figcaption className="mt-4 text-center text-caption text-muted-foreground">
              Sample roadmap with example data, read-only here.{' '}
              <Link
                to="/example"
                className="font-semibold text-primary-text underline underline-offset-4 hover:text-foreground"
              >
                Open the full example
              </Link>
            </figcaption>
          </figure>
        </div>
      </div>
    </div>
  )
}

const BENEFITS = [
  {
    title: 'Plan strategically',
    body: 'Start from an objective, break it into initiatives, then into features. You get a clear line from why to what, without learning a framework first.',
  },
  {
    title: 'Prioritise confidently',
    body: 'Score each item on impact, confidence and effort from one to five. Simple enough to do in a minute, clear enough to argue from.',
  },
  {
    title: 'Visualise clearly',
    body: 'One set of records, shown as now, next and later, a timeline or a board. Change the plan once and every view agrees.',
  },
  {
    title: 'Share professionally',
    body: 'Keep a roadmap that is easy to explain to a client, a co-founder or an investor.',
    note: 'Image and PDF export are not built yet. Today you can back up everything as a file.',
  },
]

function Benefits() {
  return (
    <section aria-labelledby="benefits-title" className={cn(band, 'bg-background')}>
      <div className={container}>
        <SectionTitle id="benefits-title" title="Decide what comes next, and show why" />
        <ul className="mt-10 border-b">
          {BENEFITS.map((b) => (
            <li
              key={b.title}
              className="grid gap-2 border-t py-6 md:grid-cols-[18rem_1fr] md:gap-10"
            >
              <h3 className="text-title font-semibold text-foreground">{b.title}</h3>
              <div className="max-w-2xl">
                <p className="leading-7">{b.body}</p>
                {b.note && <p className="mt-2 text-caption text-muted-foreground">{b.note}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const VIEW_ROWS = [
  {
    layout: 'now-next-later',
    name: 'Now, next, later',
    body: 'The simplest honest roadmap. Group work by when you will get to it, not by dates you cannot promise.',
    fit: 'Best for early products and anyone who dislikes false precision.',
  },
  {
    layout: 'timeline',
    name: 'Timeline',
    body: 'See work laid out across months, with milestones marked. Useful when something has to land by a date.',
    fit: 'Best for launches, client deadlines and planning around time off.',
  },
  {
    layout: 'board',
    name: 'Board',
    body: 'See everything by status, from idea to shipped, to spot what is stuck and what is ready to start.',
    fit: 'Best for a weekly check of where things stand.',
  },
] as const

function Features() {
  const bundle = useMemo(
    () =>
      resolveTemplate(getTemplate(DEFAULT_SAMPLE_TEMPLATE_ID)!, { product: { name: 'Sample' } }),
    [],
  )
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className={cn(band, 'border-t bg-surface')}
    >
      <div className={container}>
        <SectionTitle id="features-title" title="Three views of the same plan">
          Your objectives, initiatives and features are stored once. Each view is a different way of
          looking at them.
        </SectionTitle>
        <div className="mt-12 flex flex-col gap-14">
          {VIEW_ROWS.map((v, i) => (
            <div key={v.layout} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <div className={cn('max-w-md', i % 2 === 1 && 'lg:order-2')}>
                <h3 className="text-xl font-semibold text-foreground">{v.name}</h3>
                <p className="mt-2 leading-7">{v.body}</p>
                <p className="mt-3 text-body font-semibold text-foreground">{v.fit}</p>
              </div>
              <div
                aria-hidden
                inert
                className={cn(
                  'max-h-80 overflow-hidden rounded-card border bg-background p-5',
                  i % 2 === 1 && 'lg:order-1',
                )}
              >
                <RoadmapLayout bundle={bundle} layout={v.layout} narrow />
              </div>
            </div>
          ))}
        </div>
        <Alert tone="info" title="Where Ordo is today" className="mt-14 max-w-3xl">
          You can plan objectives, initiatives and features, then build roadmaps in all three views,
          with drag and drop and undo. Sharing a roadmap as an image or PDF is not built yet, and
          everything stays in your own browser.
        </Alert>
      </div>
    </section>
  )
}

function Templates() {
  return (
    <section
      id="templates"
      aria-labelledby="templates-title"
      className={cn(band, 'border-t bg-background')}
    >
      <div className={container}>
        <SectionTitle id="templates-title" title="Start from a template, or from nothing">
          Each template is a complete starter plan with objectives, initiatives, features and
          milestones. Using one makes your own copy; the original is never changed.
        </SectionTitle>
        <ul className="mt-10 border-b">
          {TEMPLATES.map((t) => (
            <li
              key={t.id}
              className="grid gap-4 border-t py-6 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10"
            >
              <div className="max-w-2xl">
                <h3 className="text-title font-semibold text-foreground">{t.name}</h3>
                <p className="mt-1 leading-7">{t.summary}</p>
                <p className="mt-2 text-caption text-muted-foreground">
                  {t.bestFor} <span className="tabular-nums">{describeTemplate(t)}.</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to={`/example?template=${t.id}`} aria-label={`Preview ${t.name}`}>
                    Preview
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/app/new?template=${t.id}`} aria-label={`Use template: ${t.name}`}>
                    Use template
                  </Link>
                </Button>
              </div>
            </li>
          ))}
          <li className="grid gap-4 border-t py-6 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10">
            <div className="max-w-2xl">
              <h3 className="text-title font-semibold text-foreground">A blank page</h3>
              <p className="mt-1 leading-7">Name your product and fill it in at your own pace.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/new">Start from scratch</Link>
            </Button>
          </li>
        </ul>
      </div>
    </section>
  )
}

const AUDIENCES = [
  {
    title: 'Solo founders',
    body: 'You are the product team, the designer and the support desk. Keep one honest plan for what to build before launch, and a way to say no to the rest.',
    template: 'solo-founder',
  },
  {
    title: 'Freelancers and consultants',
    body: 'Agree outcomes with a client, show progress in stages, and keep a separate plan for each engagement without a separate tool for each.',
    template: 'feature-development',
  },
  {
    title: 'Small product teams',
    body: 'Give everyone one shared picture of priorities. Sharing is by backup file for now: Ordo has no accounts or live collaboration yet.',
    template: 'saas-product',
  },
]

function Audience() {
  return (
    <section aria-labelledby="audience-title" className={cn(band, 'border-t bg-surface')}>
      <div className={container}>
        <SectionTitle id="audience-title" title="Made for people who plan with small teams" />
        <div className="mt-10 grid gap-10 md:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="border-t-2 border-foreground pt-4">
              <h3 className="text-title font-semibold text-foreground">{a.title}</h3>
              <p className="mt-2 leading-7">{a.body}</p>
              <p className="mt-4">
                <Link
                  to={`/app/new?template=${a.template}`}
                  className="text-body font-semibold text-primary-text underline underline-offset-4 hover:text-foreground"
                >
                  Start with {getTemplate(a.template)!.name}
                </Link>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const INCLUDED = [
  'Plan objectives, initiatives and features',
  'Build several roadmaps in three views',
  'Back up and restore everything as a file',
  'Your data stays in your browser',
  'No account and no card',
]

function Pricing() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className={cn(band, 'border-t bg-background')}
    >
      <div className={cn(container, 'grid gap-10 lg:grid-cols-2 lg:gap-16')}>
        <SectionTitle id="pricing-title" title="Free to use">
          Ordo is free while it is in its first version. There is nothing to buy and no payment is
          taken or requested.
        </SectionTitle>
        <div className="rounded-card border p-6 sm:p-8">
          <p className="font-display text-3xl text-foreground">Free</p>
          <ul className="mt-5 flex flex-col gap-3">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-3 text-body">
                <Check className="mt-0.5 size-4 shrink-0 text-primary-text" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <Button asChild variant="primary" className="mt-7">
            <Link to="/app/new">Create your roadmap</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

const FAQ = [
  {
    q: 'Where is my data stored?',
    a: 'In your browser, on your device, in IndexedDB. Ordo does not upload your roadmap to a server. Clearing the site’s data in your browser removes it, so download a backup from Data and backup now and then.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. There is nothing to register for, and the Sign in link only explains that. You can start in a few seconds.',
  },
  {
    q: 'Is my data private?',
    a: 'Your products, notes and roadmaps stay on your device and are not part of any request Ordo makes. Loading the website is an ordinary web request, and the host may keep standard logs. The Privacy page says more.',
  },
  {
    q: 'Can I export my work?',
    a: 'You can download everything as one JSON backup file and restore it later, in this or another browser. Presentation exports such as image or PDF are not available yet.',
  },
  {
    q: 'Can I use it on more than one device, or with a team?',
    a: 'Not live. Each browser holds its own data, and there is no sync or real-time collaboration. To move or share a plan, send a backup file.',
  },
  {
    q: 'What does Ordo cover, and what does it not?',
    a: 'Ordo is for deciding and communicating what to build: objectives, initiatives, features, simple scoring and roadmap views. It is not a task tracker, a time tracker or a project scheduler, it has no integrations, and it uses no AI.',
  },
]

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className={cn(band, 'border-t bg-surface')}>
      <div className={cn(container, 'grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16')}>
        <SectionTitle id="faq-title" title="Questions, answered plainly" />
        <div className="border-b">
          {FAQ.map((f) => (
            <details key={f.q} className="group border-t">
              <summary className="flex cursor-pointer items-center justify-between gap-6 rounded-sm py-5 text-title font-semibold text-foreground">
                {f.q}
                <ChevronDown
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="max-w-prose pb-5 leading-7">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function Closing() {
  return (
    <section aria-labelledby="closing-title" className="border-t bg-background py-20 sm:py-28">
      <div className={cn(container, 'flex flex-col items-center text-center')}>
        <h2 id="closing-title" className="max-w-2xl text-3xl sm:text-5xl">
          Start with a blank page or a template.
        </h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild variant="primary" size="lg">
            <Link to="/app/new">Create your roadmap</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/example">Explore an example</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

export function LandingPage() {
  usePageTitle()
  return (
    <>
      <Hero />
      <Benefits />
      <Features />
      <Templates />
      <Audience />
      <Pricing />
      <Faq />
      <Closing />
    </>
  )
}
