# Deployment

Ordo is a static site. There is no server, no database and no secret to configure: everything a person makes is stored in their own browser. Any static host can serve it; these steps are for Vercel, which this repository is set up for.

## Requirements

- Node.js 22 or later, and npm.
- Nothing else. No environment variables are required.

## Build and check locally

```
npm ci
npm run check          # typecheck, lint, unit tests, production build
npm run test:e2e       # end-to-end tests against the production build (first run: npx playwright install chromium)
npm run preview        # serve dist/ at http://localhost:4173, with the same security headers as production
```

`npm run build` writes the site to `dist/`. The page files are split by route and by library, so a first visit downloads only what it shows.

## Deploy to Vercel

1. Push the repository to GitHub and import it in Vercel. The framework is detected as Vite.
2. Keep the defaults, which `vercel.json` already states: build command `npm run build`, output directory `dist`.
3. Deploy. Every push to `main` becomes a production deployment; other branches get preview URLs.

Or from the command line: `npx vercel --prod`.

`vercel.json` also does two things that matter:

- **Rewrites** every path that is not a file to `index.html`, so a reload on `/app/roadmaps/…` opens the app instead of a 404. Unknown addresses then show Ordo's own not-found page.
- **Headers**: a strict Content-Security-Policy (scripts only from the site itself, no inline scripts, no plugins, not embeddable), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy: no-referrer`, a `Permissions-Policy` that turns off camera, microphone, location and payment, and long-lived caching for the hashed files in `/assets`.

`npm run preview` and the end-to-end tests serve the same headers (read from `vercel.json`), so a script or style the policy would block fails a test before it can fail for a visitor.

## Environment configuration

None is needed. See `.env.example`.

**Analytics are off.** If, and only if, you want privacy-friendly page-view counting, set at build time:

```
VITE_ANALYTICS_DOMAIN=your-site.example
VITE_ANALYTICS_SRC=https://plausible.io/js/script.js   # optional; must be https
```

Then add the script's host to `script-src` and `connect-src` in `vercel.json`, or the browser will refuse to load it. Use a cookie-less service. The counting script is never loaded for visitors who send Do Not Track or Global Privacy Control, nothing about a product or roadmap is ever passed to it, and the Privacy page changes its wording to say analytics are in use. Do not put secrets in `VITE_` variables: they are published in the built files.

## After deploying

- Open `/`, `/app`, `/app/data` and a roadmap; reload on a deep link such as `/app/roadmaps/<id>`.
- In the browser's network panel, check the response headers include `Content-Security-Policy`.
- Check the Privacy and Terms pages read correctly for your deployment, and add a contact address to the Contact page if you publish one.
- A new deployment while someone has the app open is handled: if a page file can no longer be fetched, they see "Ordo has been updated" with a Reload button, and their work is untouched.

## Rolling back

Use Vercel's "Instant Rollback" on a previous deployment. Data lives in each visitor's browser, so a rollback cannot lose anything. The data format is versioned, and an older release refuses a backup from a newer one with a clear message rather than misreading it.

## Changing the data format

Add a Dexie version in `src/storage/migrations.ts`, bump `SCHEMA_VERSION`, add a `BACKUP_MIGRATIONS[n]` step so older backups keep restoring, and add tests. See `docs/DATA_MODEL.md`.
