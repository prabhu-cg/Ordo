import { Archive, ChevronDown, Info, Layers, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast'
import { Tooltip } from '@/components/ui/tooltip'
import { PageHeader } from '@/components/shell/page-header'

const SWATCH_GROUPS: {
  title: string
  note: string
  tokens: { name: string; css: string; use: string }[]
}[] = [
  {
    title: 'Brand',
    note: 'One amber voice, used as a fill. Text that carries the accent is ochre.',
    tokens: [
      { name: 'primary', css: '--primary', use: 'Primary button, selected fills' },
      { name: 'primary-hover', css: '--primary-hover', use: 'Hover of the fill' },
      { name: 'primary-text', css: '--primary-text', use: 'Accent as text, focus ring' },
      { name: 'primary-soft', css: '--primary-soft', use: 'Selected row, current nav' },
      { name: 'primary-foreground', css: '--primary-foreground', use: 'Text on amber' },
    ],
  },
  {
    title: 'Surfaces',
    note: 'White paper for work, a pale butter desk for chrome, sand for hover.',
    tokens: [
      { name: 'background', css: '--background', use: 'Paper: pages, cards, inputs' },
      { name: 'surface', css: '--surface', use: 'Desk: sidebar, drawer chrome' },
      { name: 'secondary', css: '--secondary', use: 'Sand: hover, disabled, skeleton' },
    ],
  },
  {
    title: 'Text and lines',
    note: 'Body ink, strong ink for headings, muted for meta. One hairline for every divider.',
    tokens: [
      { name: 'foreground', css: '--foreground', use: 'Headings, labels' },
      { name: 'ink', css: '--ink', use: 'Body text' },
      { name: 'muted-foreground', css: '--muted-foreground', use: 'Meta, column headers' },
      { name: 'border', css: '--border', use: 'Hairline dividers' },
      { name: 'border-strong', css: '--border-strong', use: 'Outline buttons, menus' },
      { name: 'input', css: '--input', use: 'Field outlines (3:1)' },
    ],
  },
  {
    title: 'Status',
    note: 'Each status has a solid for text and icons and a soft ground.',
    tokens: [
      { name: 'success', css: '--success', use: 'Done, saved' },
      { name: 'success-soft', css: '--success-soft', use: 'Ground' },
      { name: 'warning', css: '--warning', use: 'Needs attention' },
      { name: 'warning-soft', css: '--warning-soft', use: 'Ground' },
      { name: 'info', css: '--info', use: 'Neutral information' },
      { name: 'info-soft', css: '--info-soft', use: 'Ground' },
      { name: 'destructive', css: '--destructive', use: 'Errors, destructive text' },
      { name: 'destructive-soft', css: '--destructive-soft', use: 'Ground' },
    ],
  },
]

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5 border-t pt-8">
      <div className="max-w-prose">
        <h2 id={id} className="text-2xl">
          {title}
        </h2>
        {description && <p className="mt-1 text-body text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-6">
      <p className="text-caption font-semibold text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

export function DesignSystemPage() {
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="flex max-w-5xl flex-col gap-10">
      <PageHeader
        title="Design system"
        description="The tokens and components every Ordo screen is built from. Toggle the theme in the header to check both modes."
      />

      <Section
        id="ds-colour"
        title="Colour"
        description="Neutral, warm and accessible. Amber is the only brand accent."
      >
        <div className="flex flex-col gap-8">
          {SWATCH_GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="text-title font-semibold text-foreground">{g.title}</h3>
              <p className="mt-0.5 text-caption text-muted-foreground">{g.note}</p>
              <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                {g.tokens.map((t) => (
                  <li key={t.name} className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="size-9 shrink-0 rounded-input border border-border-strong"
                      style={{ background: `var(${t.css})` }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-body font-semibold text-foreground">
                        {t.name}
                      </span>
                      <span className="block truncate text-caption text-muted-foreground">
                        {t.use}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="ds-type"
        title="Typography"
        description="A quiet serif for headlines, a plain humanist sans for the work. Hierarchy from face, weight and a few fixed sizes."
      >
        <dl className="divide-y border-y">
          {[
            [
              'Headline · Newsreader 500 · 28',
              <p key="a" className="font-display text-headline leading-tight">
                Plan better. Build smarter
              </p>,
            ],
            [
              'Title · DM Sans 600 · 15',
              <p key="b" className="text-title font-semibold text-foreground">
                Launch the public beta
              </p>,
            ],
            [
              'Body · DM Sans 400 · 14',
              <p key="c" className="max-w-prose text-body">
                Roadmaps are a way of saying what comes first and why. Keep each item to a sentence.
              </p>,
            ],
            [
              'Caption · 13',
              <p key="d" className="text-caption text-muted-foreground">
                Updated 3 min ago
              </p>,
            ],
            [
              'Label · DM Sans 600 · 12',
              <p key="e" className="text-label font-semibold text-muted-foreground">
                Status
              </p>,
            ],
            [
              'Tabular numerals',
              <p key="f" className="text-body tabular-nums">
                1,234 · 0.55 · 12 of 40
              </p>,
            ],
          ].map(([name, sample]) => (
            <div key={String(name)} className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
              <dt className="text-caption text-muted-foreground">{name}</dt>
              <dd>{sample}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        id="ds-shape"
        title="Shape and depth"
        description="Pills for buttons, 8px inputs, 12px menus, 20px cards and dialogs. Flat at rest; shadows only for what leaves the page."
      >
        <div className="flex flex-wrap items-end gap-6">
          {[
            ['Pill', 'rounded-full', 'h-10 w-24'],
            ['Input 8px', 'rounded-input', 'h-10 w-24'],
            ['Menu 12px', 'rounded-menu', 'h-16 w-24'],
            ['Card 20px', 'rounded-card', 'h-20 w-24'],
          ].map(([label, radius, size]) => (
            <figure key={label} className="flex flex-col items-start gap-2">
              <div className={`${radius} ${size} border border-border-strong bg-surface`} />
              <figcaption className="text-caption text-muted-foreground">{label}</figcaption>
            </figure>
          ))}
          <figure className="flex flex-col items-start gap-2">
            <div className="h-20 w-24 rounded-menu border bg-popover shadow-menu" />
            <figcaption className="text-caption text-muted-foreground">Menu shadow</figcaption>
          </figure>
          <figure className="flex flex-col items-start gap-2">
            <div className="h-20 w-24 rounded-card border bg-popover shadow-raised" />
            <figcaption className="text-caption text-muted-foreground">Dialog shadow</figcaption>
          </figure>
        </div>
        <p className="text-caption text-muted-foreground">
          Spacing steps are 4, 8, 12, 16, 24 and 32px. Page gutters are 16 / 24 / 32px; the app
          container is 1440px.
        </p>
      </Section>

      <Section
        id="ds-buttons"
        title="Buttons"
        description="Every button is a pill. One filled button per view; repeated actions are outline. Destructive is outline with red text."
      >
        <div className="flex flex-col gap-4">
          <Row label="Variants">
            <Button variant="primary">Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </Row>
          <Row label="Sizes">
            <Button variant="primary" size="xs">
              Extra small
            </Button>
            <Button variant="primary" size="sm">
              Small
            </Button>
            <Button variant="primary">Default</Button>
            <Button variant="primary" size="lg">
              Large
            </Button>
            <Button variant="outline" size="icon" aria-label="Add">
              <Plus aria-hidden />
            </Button>
          </Row>
          <Row label="States">
            <Button variant="primary" loading>
              Saving
            </Button>
            <Button variant="outline" disabled>
              Disabled
            </Button>
            <Button variant="outline">
              <Plus aria-hidden /> With icon
            </Button>
          </Row>
        </div>
      </Section>

      <Section
        id="ds-fields"
        title="Fields"
        description="40px tall, 8px radius, a 3:1 outline and an ochre focus ring. Errors say what is wrong and how to fix it."
      >
        <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
          <Field label="Name" hint="Shown in the sidebar.">
            {(c) => <Input {...c} placeholder="Atlas" />}
          </Field>
          <Field label="Name" error="Add a name to continue.">
            {(c) => <Input {...c} defaultValue="" />}
          </Field>
          <Field label="Status">
            {(c) => (
              <Select {...c} defaultValue="planned">
                <option value="idea">Idea</option>
                <option value="planned">Planned</option>
                <option value="in-progress">In progress</option>
              </Select>
            )}
          </Field>
          <Field label="Disabled">{(c) => <Input {...c} disabled defaultValue="Locked" />}</Field>
          <Field label="Notes" note="optional" className="sm:col-span-2">
            {(c) => <Textarea {...c} rows={3} />}
          </Field>
        </div>
      </Section>

      <Section
        id="ds-badges"
        title="Badges and tabs"
        description="Badges are 20px pills. The current tab is butter, not grey."
      >
        <Row label="Badges">
          <Badge>Soft</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Shipped</Badge>
          <Badge variant="warning">At risk</Badge>
          <Badge variant="info">Planned</Badge>
          <Badge variant="destructive">Dropped</Badge>
        </Row>
        <Tabs defaultValue="now" className="max-w-xl">
          <TabsList aria-label="Example tabs">
            <TabsTrigger value="now">Now</TabsTrigger>
            <TabsTrigger value="next">Next</TabsTrigger>
            <TabsTrigger value="later">Later</TabsTrigger>
          </TabsList>
          <TabsContent value="now" className="text-body">
            The current tab is selected with the amber tint. Arrow keys move between tabs.
          </TabsContent>
          <TabsContent value="next" className="text-body">
            Content for the second tab.
          </TabsContent>
          <TabsContent value="later" className="text-body">
            Content for the third tab.
          </TabsContent>
        </Tabs>
      </Section>

      <Section
        id="ds-cards"
        title="Cards"
        description="A 20px container with a hairline, flat at rest, with an optional footer on the desk ground."
      >
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Card title</CardTitle>
            <CardDescription>
              Use a card for one self-contained thing, never as a wrapper for a list of comparable
              records.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" size="sm">
              Action
            </Button>
          </CardFooter>
        </Card>
      </Section>

      <Section
        id="ds-overlays"
        title="Menus, tips, dialogs and drawers"
        description="Create, edit and settings open as a right-hand drawer. Only destructive confirmations interrupt, as a centred dialog."
      >
        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Menu <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem>
                <Layers aria-hidden /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Archive aria-hidden /> Archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive>
                <Trash2 aria-hidden /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip content="Tooltips repeat what is already labelled">
            <Button variant="outline" size="icon" aria-label="About tooltips">
              <Info aria-hidden />
            </Button>
          </Tooltip>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>A short decision</DialogTitle>
                <DialogDescription>Dialogs hold one question and its answer.</DialogDescription>
              </DialogHeader>
              <DialogBody />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="primary">Continue</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline">Drawer</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Edit item</DrawerTitle>
                <DrawerDescription>Chrome sits on the desk, content on paper.</DrawerDescription>
              </DrawerHeader>
              <DrawerBody className="flex flex-col gap-5">
                <Field label="Title">{(c) => <Input {...c} />}</Field>
                <Field label="Details" note="optional">
                  {(c) => <Textarea {...c} />}
                </Field>
              </DrawerBody>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DrawerClose>
                <DrawerClose asChild>
                  <Button variant="primary">Save</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>

          <Button variant="destructive" onClick={() => setConfirm(true)}>
            Confirm dialog
          </Button>
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title="Delete this item?"
            description="Say what will happen and whether it can be undone."
            confirmLabel="Delete item"
            destructive
            onConfirm={() => toast.success('Item deleted')}
          />
        </div>
      </Section>

      <Section
        id="ds-feedback"
        title="Feedback"
        description="Confirmations, warnings, empty and loading states."
      >
        <div className="flex flex-col gap-3">
          <Alert tone="success" title="Backup restored">
            Three products are now on this device.
          </Alert>
          <Alert tone="info" title="Saved on this device">
            Nothing leaves your browser.
          </Alert>
          <Alert tone="warning" title="Storage is almost full">
            Download a backup before adding more.
          </Alert>
          <Alert tone="destructive" title="Could not save">
            Your change was not written. Try again.
          </Alert>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => toast.success('Saved', 'Your change is stored on this device.')}
          >
            Success toast
          </Button>
          <Button
            variant="outline"
            onClick={() => toast.info('Heads up', 'Informational message.')}
          >
            Info toast
          </Button>
          <Button
            variant="outline"
            onClick={() => toast.error('Could not save', 'Try again in a moment.')}
          >
            Error toast
          </Button>
        </div>
        <EmptyState
          icon={<Layers />}
          title="Nothing here yet"
          description="One line that says what this is for, then the single next action."
          action={
            <Button variant="outline">
              <Plus aria-hidden /> Add the first one
            </Button>
          }
        />
        <div className="flex max-w-md flex-col gap-3" role="status" aria-label="Loading example">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </Section>
    </div>
  )
}
