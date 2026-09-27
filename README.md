# Mic Plot

An open-source tool for a theatre A2 (audio) crew to track wireless mic
assignments across multiple shows running in repertory.

Originally prototyped as a Google Apps Script app; this is the ground-up
rebuild as a self-hosted web app.

## Stack

- **Server:** Node.js + TypeScript + [Fastify](https://fastify.dev)
- **Database:** SQLite via [Drizzle ORM](https://orm.drizzle.team) —
  zero-setup, single-file, easy to back up. Drizzle also supports Postgres,
  so migrating to it later (e.g. for a hosted multi-org version) is a config
  change, not a rewrite.
- **Photos:** stored on local disk behind a small storage interface
  (`src/server/storage.ts`) so a hosted version could later swap in S3/R2
  without touching routes. The server always streams photo bytes back
  itself rather than redirecting to a cross-origin URL — this sidesteps a
  Safari/iPadOS image-loading bug hit in the original prototype.
- **Auth:** a single shared password for the whole crew (optional — leave
  `APP_PASSWORD` unset to run with no login on a trusted network). This is a
  real seam, not a stub: routes only ever call `requireAuth()`, so swapping
  in per-user accounts later doesn't touch route code. Admin pages are
  additionally gated by an `ADMIN_PIN` overlay with a server-side session
  cookie.
- **Live updates:** dashboard clients subscribe to `/api/events` (Server-Sent
  Events, `src/server/routes/events.ts`); any write in `mics.ts` broadcasts
  a `mics_updated` event to everyone watching that show, so the grid
  refreshes without polling.
- **Deployment:** Docker + docker-compose. `docker compose up` is the whole
  install story, on Mac, Linux, or Windows. The published image goes to
  `ghcr.io` on merges to `main`; `deploy/` holds compose files for a
  Dockge/TrueNAS host (service names avoid hyphens for Dockge compatibility),
  plus a separate staging compose for the `dev` branch. CI
  (`.github/workflows/ci.yml`) runs typecheck on every branch, not just
  `main`/`dev`.

## Data model

- `orgs` — exists from day one (even with a single hardcoded row today) so a
  future hosted/multi-tenant version doesn't require a schema rewrite.
- `shows` — admin-managed list, `active` flag hides retired shows from
  crew-facing pickers without deleting history.
- `mic_entries` — one row per **Show + Mic ID** combination. `mic_id` is
  always `TEXT`, never inferred as a number (leading zeros like `"01"` must
  round-trip exactly). Fields cover performer, character, pronouns, mic
  color/placement/sensitivity, mic model/frequency/pack model, allergy flag,
  notes, and status (`not_started` / `miced` / `checked`, dashboard-only).
- `mic_photos` — multiple photos per mic entry.
- `shows.fieldConfig` — nullable per-show JSON that toggles which fields
  appear on the entry form and dashboard (null = all fields on, for backward
  compat with shows created before this existed).

See `src/server/db/schema.ts` for the full schema with field-level comments.

## Running it

### With Docker (recommended)

```bash
cp .env.example .env      # optionally set APP_PASSWORD
docker compose up --build
```

Then open http://localhost:3000.

### Locally, without Docker

```bash
npm install
npm run db:generate   # generate SQL migrations from the schema
npm run db:migrate    # apply them + seed the default org
npm run dev            # starts the API with hot reload
```

## Project layout

```
src/
  server/
    db/
      schema.ts       # Drizzle schema — the source of truth for the data model
      index.ts         # DB connection
      migrate.ts        # migration runner + default-org seed
    routes/
      shows.ts          # admin show list, per-show field config
      mics.ts            # core mic-entry CRUD, mic switcher, status toggle
      photos.ts           # photo upload/serve
      events.ts             # SSE broadcast for live dashboard updates
      qr.ts                   # QR code generation for the share link
      auth.ts               # login/logout
    auth.ts             # shared-password session middleware
    storage.ts          # photo storage abstraction
    index.ts            # Fastify app + route wiring
  client/
    index.html          # landing/redirect page
    mic-form.html         # mic entry form
    dashboard.html          # live status grid: search/filter, photo gallery, edit panel
    admin.html                 # shows CRUD, field config, bulk mic generation, PIN gate
    manifest.json, icon.svg    # PWA support
```

## What's built vs. what's next

**Built:** the full API (shows, mic entries, mic switcher lookup, photo
upload/serve, status toggle, shared-password + admin-PIN auth, SSE live
updates), the database schema and migrations, and the full frontend — mic
entry form, dashboard (search/filter/edit panel/photo management, per-show
field config), and admin panel (show setup, bulk mic generation, archive
state). Also built: hamburger nav across all pages, QR-code share button,
PWA install support, and a working Docker deploy publishing to `ghcr.io`
with staging/production compose files for a Dockge/TrueNAS host.

**Not built yet:** nothing tracked in this README — check open issues/PRs on
the `dev` branch for the current work-in-progress state.

## Design system reference

- Black background (`#000000`), dark grey fields/cards (`#141414`/`#111111`),
  grey borders (`#2c2c2c`/`#3a3a3a`)
- Muted purple accent (`#7a5cf0`) for primary actions/focus
- Muted green (`#3f9e6d`) used *only* for the "Checked" status
- Red (`#c25b52`) for warnings/allergy flags
- Helvetica Neue, medium weight (500) throughout — deliberately plain, no
  display fonts, minimal iconography
- (The placeholder page in `src/client/index.html` already uses these as CSS
  variables.)

## License

MIT — see `LICENSE`.
