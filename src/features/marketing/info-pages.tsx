import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { usePageTitle } from './use-page-title'

function InfoPage({
  title,
  intro,
  children,
}: {
  title: string
  intro?: string
  children: React.ReactNode
}) {
  usePageTitle(title)
  return (
    <div className="bg-surface">
      <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <h1 className="text-4xl sm:text-5xl">{title}</h1>
        {intro && (
          <p className="mt-3 max-w-prose text-[1.0625rem] text-muted-foreground">{intro}</p>
        )}
        <div className="mt-8 rounded-card border bg-card p-6 sm:p-8 [&_a]:font-semibold [&_a]:text-primary-text [&_a]:underline [&_a:hover]:text-foreground [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2:first-child]:mt-0 [&_p]:mt-2 [&_p]:max-w-prose [&_p]:text-body [&_p]:leading-7 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-body [&_ul]:leading-7">
          {children}
        </div>
      </div>
    </div>
  )
}

export function PrivacyPage() {
  return (
    <InfoPage title="Privacy" intro="What Ordo does with your data today, in plain terms.">
      <h2 className="font-sans">Where your work lives</h2>
      <p>
        Everything you create in Ordo is stored in your browser, on this device, using IndexedDB.
        Ordo does not upload your products, roadmaps or notes to a server.
      </p>
      <h2 className="font-sans">Accounts</h2>
      <p>
        Ordo has no accounts in this version, so it holds no email address, password or profile for
        you.
      </p>
      <h2 className="font-sans">What leaves your device</h2>
      <p>
        Loading the site is an ordinary web request to wherever Ordo is hosted, and that host may
        keep standard request logs. Your roadmap data is not part of those requests. If you download
        a backup file, it is yours to store and share as you choose.
      </p>
      <h2 className="font-sans">Removing your data</h2>
      <p>
        Clearing this site’s data in your browser removes everything Ordo has stored. Download a
        backup from <Link to="/app/data">Data and backup</Link> first if you want to keep it.
      </p>
      <h2 className="font-sans">Status of this page</h2>
      <p>
        This describes how the current version behaves. It is not a legal policy, and a formal one
        has not been published yet.
      </p>
    </InfoPage>
  )
}

export function TermsPage() {
  return (
    <InfoPage title="Terms" intro="Formal terms have not been published yet.">
      <p>
        Ordo is an early version, and no terms of service have been written for it. This page will
        be replaced with real terms before Ordo is offered more widely.
      </p>
      <p>
        In the meantime, the useful practical facts are on the <Link to="/privacy">Privacy</Link>{' '}
        page and in the <Link to="/help">Help</Link> page: your data stays in your browser, and you
        are responsible for keeping backups.
      </p>
    </InfoPage>
  )
}

export function ContactPage() {
  return (
    <InfoPage title="Contact" intro="There is no public contact address yet.">
      <p>
        No email address, form or support channel has been published for Ordo, so none is listed
        here. When there is somewhere to write to, it will appear on this page.
      </p>
      <p>
        If something is not working, the <Link to="/help">Help</Link> page covers the most common
        questions about saving and restoring your work.
      </p>
    </InfoPage>
  )
}

export function HelpPage() {
  return (
    <InfoPage title="Help" intro="Short answers about how Ordo works today.">
      <h2 className="font-sans">Getting started</h2>
      <ul>
        <li>
          <Link to="/app/new">Create a product</Link> from scratch or from a template.
        </li>
        <li>
          <Link to="/app/onboarding">Take the short guide</Link> to objectives, initiatives,
          features, prioritisation and roadmap views.
        </li>
        <li>
          <Link to="/example">Explore the example roadmap</Link>. It is read-only and never changes
          your own products.
        </li>
      </ul>
      <h2 className="font-sans">Where is my work saved?</h2>
      <p>In this browser, on this device. It does not follow you to another browser or computer.</p>
      <h2 className="font-sans">How do I keep it safe?</h2>
      <p>
        Open <Link to="/app/data">Data and backup</Link> and download a backup file now and then.
        You can restore it in any browser.
      </p>
      <h2 className="font-sans">I cleared my browser data</h2>
      <p>
        Ordo’s data is stored with the site’s data, so clearing it removes your products. Restore
        from your latest backup file if you have one.
      </p>
      <h2 className="font-sans">Sign in</h2>
      <p id="accounts">Accounts are not part of this version. There is nothing to sign in to.</p>
    </InfoPage>
  )
}

export function SignInPage() {
  usePageTitle('Sign in')
  return (
    <div className="bg-surface">
      <div className="mx-auto flex w-full max-w-xl flex-col items-start px-4 py-20 sm:px-6 sm:py-28">
        <h1 className="text-4xl sm:text-5xl">No sign-in needed</h1>
        <p className="mt-4 max-w-prose text-[1.0625rem] text-muted-foreground">
          Ordo does not have accounts yet. Your work is saved in this browser, so you can start
          right away.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="primary" size="lg">
            <Link to="/app">Open Ordo</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/help">How saving works</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

const STACK: [string, string][] = [
  ['Interface', 'React and TypeScript, built with Vite'],
  ['Styling', 'Tailwind CSS, with accessible components built on Radix'],
  ['State', 'Zustand'],
  ['Storage', 'IndexedDB through Dexie, in your browser'],
  ['Validation', 'Zod, on every write and every restored backup'],
  ['Drag and drop', 'dnd-kit'],
  ['Testing', 'Vitest and Playwright'],
]

export function AboutPage() {
  return (
    <InfoPage title="About Ordo" intro="Plan better. Build smarter">
      <h2 className="font-sans">What it is</h2>
      <p>
        Ordo is a product roadmap builder for people who plan with small teams: solo founders,
        freelancers and consultants, startup founders and small product teams. You write down
        objectives, break them into initiatives and features, score what matters, and show the plan
        as now, next and later; as a timeline; or as a board. The three views read one set of
        records, so a change in one shows in the others.
      </p>
      <p>
        It is local-first. Your work is saved in your browser, there is no account to make, and
        nothing is uploaded. You can back everything up as a file and restore it anywhere.
      </p>

      <h2 className="font-sans">How it is built</h2>
      <dl className="mt-3 divide-y border-y">
        {STACK.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <dt className="text-body font-semibold text-foreground">{label}</dt>
            <dd className="text-body">{value}</dd>
          </div>
        ))}
      </dl>
      <p>
        There is no server for your data and no AI in this version. Data has a versioned format with
        migrations, so your backups keep working as Ordo changes.
      </p>

      <h2 className="font-sans">What is live, and what is next</h2>
      <p>
        Live today: <Link to="/app/new">products</Link> with objectives, measurable outcomes,
        initiatives and features; search, filters and sorting; roadmaps in three views with drag and
        drop, dependencies, milestones and undo; templates and an example roadmap; and{' '}
        <Link to="/app/data">backup and restore</Link>.
      </p>
      <p>
        Not built yet: sharing a roadmap as an image or PDF, accounts, and syncing between devices
        or live collaboration. If that changes, this page will say so.
      </p>

      <h2 className="font-sans">Who built it, and why</h2>
      <p>
        Ordo is an early version. It aims to make planning a product simpler than traditional
        product management software: no account to make and nothing to set up before you can start,
        with your plan kept on your own device.
      </p>
      <p>
        No contact address has been published yet. The <Link to="/contact">Contact</Link> page will
        list one when there is somewhere to write to.
      </p>
    </InfoPage>
  )
}
