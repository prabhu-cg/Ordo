# Design system

Tokens follow Doxa's "White Paper on a Butter Desk" (github.com/prabhu-cg/Doxa, DESIGN.md). They live in `src/index.css` as CSS variables with a `.dark` override, exposed to Tailwind via `@theme inline`. Live reference: the **Design system** page in the app.

- **Colour:** paper (`background`), desk (`surface`), sand (`secondary`); ink / foreground / muted text; hairline `border`, `border-strong`, field `input` (3:1); one amber `primary` fill; ochre `primary-text` for accent text and focus; `primary-soft` for selection; charcoal on amber; success / warning / info / destructive with `-soft` grounds.
- **Type:** Newsreader 500 for every h1/h2 (28px headline); DM Sans for everything else; fixed sizes 12/13/14/15/16/28; tabular numerals for data.
- **Shape:** pill buttons, 8px inputs, 12px menus, 20px cards/dialogs/drawers.
- **Depth:** flat at rest; shadows only on drawers, dialogs, menus.
- **Focus:** 3px ochre ring at 40%; field focus turns the border ochre.
- **Motion:** feedback only, 140–220ms exponential ease-out; reduced motion drops travel.
- **Rules:** one filled primary button per view; destructive = outline with red text; create/edit in a right drawer, destructive confirmation in a centred dialog; no second accent, no gradients.

Components (`src/components/ui`): Button, Input, Textarea, Select (native), Label, Field, Badge, Card, Tabs, Tooltip, DropdownMenu, Dialog, ConfirmDialog, Drawer, EmptyState, Alert, Toast, Skeleton.

Ordo's wordmark is the text "Ordo" in the display serif with the tagline "Plan better. Build smarter" (placeholder until a mark exists).

## Logo

`public/ordo-logo.svg` is the supplied mark (a ring with an amber swoosh). The app renders it inline (`components/shell/logo-mark.tsx`, paths unchanged) so the ring follows the theme's foreground colour and stays visible in dark mode; the swoosh keeps its authored colour (`--logo-accent`). `public/favicon.svg` is the same paths with a `prefers-color-scheme` rule that lightens the ring on dark browser chrome.

`cn()` (`lib/utils.ts`) is configured with our custom font-size, radius and shadow tokens. Without that, tailwind-merge mistakes `text-body` for a colour and drops the variant's real text colour.

## Indicators

`components/domain/indicators.tsx` is the one place that draws priority, confidence, impact and effort, and dependency state, so a table, a card and the matrix look the same. Colour is never the only signal: priority has an arrow (critical ▲▲, high ▲, medium =, low ▼), confidence an icon (exploring, tentative, committed), and every badge says its word. Confidence and dependency badges are focusable and explain themselves in a tooltip, so keyboard users get the same help as people with a mouse.

Toasts (`components/ui/toast.tsx`) are our own rather than Radix's. They do not react to Escape, so the key always closes the drawer or dialog you are in, and an Undo button is not lost when you close what you just edited.

## Appearance and print

Six tones (grey, gold, blue, green, orange, red) are the only colours a person can choose, for statuses and roadmaps. Each is a semantic token with a soft and a solid form (`lib/appearance.ts`), so every choice keeps its contrast in light and dark. A status always shows its name as well as its colour.

Density sets three variables (`--card-pad`, `--card-gap`, `--row-pad`) on the root; cards and table rows read them. It is copied to `localStorage` so it is right on the first paint.

A printed page is always white with dark ink, whatever the screen theme: the print page removes the dark class while it is open and puts it back on leaving. Page furniture (margin, running header, footer) is fixed in `features/export/print-model.ts`.

A card is one focusable element named by exactly the words it shows (its title); its other details are ordinary text beside it. This keeps the accessible name inside what is visible ("label in name") and lets a screen reader read priority, dates and the rest.

## Entry points and leaving a drawer

The public header's call to action follows the visitor's own data: "Get started" (to `/app/new`) while their browser holds no products, "Open Ordo" (to `/app`) once it does. Data is per origin, so a development server and production can legitimately differ.

Creating a product is a drawer over the dashboard at `/app/new`. Closing it (Cancel, Escape, the backdrop) goes back only when the previous page was inside the app; arriving from the public site, or directly, it goes to `/app` and replaces the entry, so Back never reopens the drawer. `app/navigation-history.ts` records the previous page for this.

