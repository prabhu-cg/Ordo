# Ordo V1 release report

Phase 5: export and production readiness. Written from what was built and run, not from intentions.

## Verdict

**No critical acceptance criterion is failing.** The complete V1 application works with no external database or service: every product, setting and history entry lives in the visitor's browser, and the deployment is a static site.

That is a verdict on what was tested. Three things could not be verified here and are worth doing before a wide launch (see "Known limitations"): a pass in Firefox and Safari, a manual screen-reader pass, and a legal read of the Privacy and Terms text.

## What is in V1

| Area                   | Implemented                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning               | Products, objectives with measurable outcomes, initiatives, features, tags, search and filters, integrity-checked deletes                                                                                                 |
| Roadmaps               | Now/next/later, timeline and board over one shared set of items; drag and drop with a keyboard alternative; undo (30 steps, kept across reloads); dependencies with validation                                            |
| Prioritisation         | Low/Medium/High impact and effort, a four-quadrant matrix with manual placement, priority and confidence, and dependency indicators                                                                                       |
| Templates              | Six starter templates, sandbox preview, duplicate, save your own roadmap as a template                                                                                                                                    |
| **Export**             | **PNG** of the current view; **PDF** via a paginated print preview (portrait or landscape, A4 or Letter, title, export date, page numbers); **CSV** with ids and parent ids; **JSON** backup of one product or everything |
| **Import and restore** | Validates structure and version, previews contents before doing anything, adds alongside (never overwrites) or replaces, and keeps what a replace removed so it can be brought back                                       |
| **Appearance**         | A colour for each status, a colour for each roadmap, density, and which details cards show                                                                                                                                |
| **Data management**    | Export all or one, archive or delete a product (name typed to confirm), delete all local data (DELETE typed), storage use and limits shown                                                                                |
| **Security**           | Strict Content-Security-Policy and protective headers, imported data validated and never executed or rendered as markup, spreadsheet-formula-safe CSV, no secrets, no tracking                                            |
| **Deployment**         | Static Vercel build, route-level code splitting, 404 page, error boundary, Privacy and Terms pages, optional privacy-first analytics (off by default)                                                                     |

## Test results

Run on the production build.

| Check                                                | Result                                                                                                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Typecheck, lint, production build                    | Clean                                                                                                                                                                                      |
| Unit and integration tests (Vitest)                  | **238 passed**, 17 files                                                                                                                                                                   |
| End-to-end tests (Playwright, Chromium)              | **161 passed**; the full suite passed on repeated runs                                                                                                                                     |
| Automated accessibility (axe, WCAG 2.0/2.1 A and AA) | **No detectable violations** on every public page, every app page, the three roadmap views, the export menu, drawers, dialogs, the print preview and the import preview, in light and dark |
| `npm audit` (production dependencies)                | 0 vulnerabilities                                                                                                                                                                          |

Phase 5 added 66 end-to-end tests. How each module's acceptance was checked:

- **Export fidelity.** The PNG is at least twice the on-screen size; the status colour of a timeline bar and a priority badge is found in the picture's pixels; a timeline wider than a phone is captured whole (the image is as wide as the scrolling content) and the page is left as it was; toolbars are not drawn into it. The CSV has the byte order mark, a stable header, every parent id present in the file, dates and statuses, and defuses a title such as `=HYPERLINK(...)`. The JSON backup contains one product only, with the schema version, and restores. The PDF is produced with the browser's own print engine in a test: its page count equals the preview's, and its paper size is A4 portrait, A4 landscape or Letter landscape as chosen. A 60-item roadmap runs onto several pages with every item appearing exactly once.
- **Import validation.** Seven kinds of bad file (not JSON, another app's JSON, a newer version, no version, damaged records, links pointing at nothing, empty) and a file over 50 MB are each refused with a plain reason and nothing changes. A version 1 backup is accepted, labelled as older, and arrives with its 1–5 scores turned into Low/Medium/High and its confidence into words. Importing a product that is still present never overwrites it: it arrives as a separate copy with new ids and intact links.
- **Security.** Every page is served with the policy; the whole app, including image export, runs under it with nothing blocked and no request leaving the site; hostile titles (`<img onerror>`, `<script>`, `<svg onload>`, `javascript:`) are shown as plain text on every screen and in the print preview and never run; `__proto__` in a file pollutes nothing.
- **Error handling.** Storage unavailable gives a clear message with Try again; a page file that fails to load gives "Ordo has been updated" with Reload and the data intact; a write that fails (simulated full disk) reports the failure and changes nothing; unknown addresses show the not-found page inside and outside the app.
- **Keyboard and accessibility.** Skip link; the export menu is usable with arrow keys and returns focus; dialogs trap focus, close on Escape and give focus back; the print preview and appearance settings work without a mouse; every control on the data page has a name. No page scrolls sideways at phone (390 px) or tablet (768 px) width.
- **Earlier phases** (CRUD, persistence, migration, drag and drop, cross-view synchronisation, dependencies) are covered by the existing 95 end-to-end and 238 unit tests, which all still pass.

### Defects found and fixed during this phase

These were real faults the new tests caught, not test problems:

- Dialogs and drawers did not return focus to the button that opened them, so a keyboard user landed at the top of the page. Fixed everywhere.
- A roadmap card's one focusable element carried a label that did not contain the words on it (WCAG 2.5.3, "label in name"), and a screen reader never read the card's priority or dates. The card is now one focusable title plus ordinary text. Same fix on the matrix.
- Several other buttons and links had a label that omitted their visible words (template links, the sidebar logo, "Add initiative", "Schedule this month", timeline bars, per-product CSV); fixed.
- Menus were modal, hiding the page from assistive technology while leaving it focusable. They are now non-modal.
- The Appearance page was not reachable (its route was missing) until the tests ran.
- Density flashed to the default on page load; it now applies before first paint.
- An inline theme script prevented a strict policy; it is now a separate file.

## Known limitations

- **Tested in Chromium only.** Firefox and Safari were not run. Safari in particular may remove a site's stored data after a period of inactivity unless the site is installed; the Data page offers "Ask the browser to keep it", and backups are the real protection. Image export draws the page through an SVG layer that browsers handle differently; it is untested outside Chromium.
- **Data stays on one device and one browser.** There is no sync, no account and no recovery if the browser's data is cleared. Backups are the user's responsibility, and the Terms and Help pages say so.
- **No cross-tab sync.** A second open tab needs a reload to see changes.
- **PDF goes through the browser's print dialog** ("Save as PDF"), not an automatic download. The document is purpose-built (lanes, a board by status, or a timeline), not a pixel copy of the screen: dependency lines are not drawn in the print timeline, which is capped at 36 months. The PNG is the faithful copy of the screen.
- **Image size limit.** Very large views are scaled down to stay inside browser canvas limits (about 16,000 pixels a side).
- **Undo** keeps 30 steps per product. A reload within a few milliseconds of an edit can lose that last step, because it is saved just after the edit.
- **Accessibility was checked with an automated tool and keyboard tests, not with a screen reader.** Automated tools find only part of the problems. Drag and drop has keyboard and menu alternatives, but touch dragging was exercised with emulated devices only, not on a physical phone.
- **Privacy and Terms are plain-language statements of how the product behaves, not reviewed legal documents.**
- **Content-Security-Policy allows inline styles** (`style-src 'unsafe-inline'`), needed for the print page's page-size rule and for element styles. Scripts are strictly same-origin.
- Enabling analytics requires editing the policy by hand (documented).

## Performance

Measured in Chromium on a development laptop, production build, imported through the Data page:

| Size                                                       | Import | Switch view (now/next/later, board, timeline) | PNG            | CSV   | Print preview   |
| ---------------------------------------------------------- | ------ | --------------------------------------------- | -------------- | ----- | --------------- |
| 180 items (60 initiatives, 120 features)                   | 0.5 s  | 23 ms, 31 ms, 67 ms                           | 1.1 s (0.9 MB) | 0.3 s | 0.4 s, 6 pages  |
| 1,200 items (300 initiatives on the roadmap, 900 features) | 0.6 s  | 53 ms, 85 ms, 107 ms                          | 3.6 s (2.3 MB) | 0.3 s | 0.4 s, 29 pages |

Download size: the largest file is 312 KB (98 KB compressed), the entry file is 101 KB (28 KB compressed), the whole `dist` folder is 1.5 MB. The image library loads only when someone exports.

Issues: boards and the matrix draw every card (no virtualisation), so dragging with many hundreds of cards on one roadmap was not measured and may feel heavy. PNG export time grows with the number of cards (about 3.6 s for 300). Neither is a problem at the sizes a single roadmap normally has.

## Accessibility issues

No automated violations remain. Open items, none verified as failures, only unverified:

- A manual screen-reader pass (VoiceOver, NVDA) has not been done, especially of drag and drop announcements, the print preview, and the timeline.
- Touch target size and focus order on a physical phone have not been checked.
- The timeline bars announce their dates and status but the chart as a whole is a visual device; the lists on the same data (initiatives table, CSV) are the accessible alternative.

## Deployment instructions

See `docs/DEPLOYMENT.md`. In short: `npm ci`, `npm run check`, then push to GitHub and import into Vercel (framework Vite, output `dist`, nothing to configure); `vercel.json` supplies the rewrites and security headers. No environment variables are needed.

## Future technical recommendations

1. **Add Firefox and WebKit to the Playwright projects** and fix what they show; then check on a real iPhone and Android phone. This is the highest-value next step.
2. **Do a manual screen-reader and zoom (400%) pass**, and keep the automated axe checks in CI.
3. **Offer automatic backups** with the File System Access API where available (and a reminder where it is not), since browser-only storage is the product's main risk.
4. **If sync or sharing is wanted, make it opt-in and end-to-end encrypted**, built on the existing versioned backup format and per-record `updatedAt`, rather than adding accounts to the core.
5. **A vector PDF** (for example generated in a worker) for people who want a download without the print dialog and a faithful dependency view.
6. **Virtualise long columns** on boards and the matrix if roadmaps with many hundreds of items are expected.
7. **Run the end-to-end suite in CI on every push** (it passes against the production build and the real headers), and add visual regression for the print layouts.
8. **Have the Privacy and Terms text reviewed**, and decide on a contact address.
9. **Split the data layer's large `react` chunk further** if first-load size becomes a concern, and consider a service worker for offline use.
10. **Opt-in, privacy-preserving error reporting** to learn about real-world storage failures.
