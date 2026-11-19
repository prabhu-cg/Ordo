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
