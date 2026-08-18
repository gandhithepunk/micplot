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
  in per-user accounts later doesn't touch route code.
- **Deployment:** Docker + docker-compose. `docker compose up` is the whole
  install story, on Mac, Linux, or Windows.

## Data model

- `orgs` — exists from day one (even with a single hardcoded row today) so a
  future hosted/multi-tenant version doesn't require a schema rewrite.
- `shows` — admin-managed list, `active` flag hides retired shows from
  crew-facing pickers without deleting history.
- `mic_entries` — one row per **Show + Mic ID** combination. `mic_id` is
  always `TEXT`, never inferred as a number (leading zeros like `"01"` must
  round-trip exactly).
- `mic_photos` — multiple photos per mic entry.

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
      shows.ts          # admin show list
      mics.ts            # core mic-entry CRUD, mic switcher, status toggle
      photos.ts           # photo upload/serve
      auth.ts               # login/logout
    auth.ts             # shared-password session middleware
    storage.ts          # photo storage abstraction
    index.ts            # Fastify app + route wiring
  client/
    index.html          # placeholder — build the entry form + dashboard here
```

## What's built vs. what's next

**Built:** the full API (shows, mic entries, mic switcher lookup, photo
upload/serve, status toggle, shared-password auth), the database schema, and
a working Docker deploy.

**Not built yet:** the actual frontend — the mic entry form and the
dashboard described in the project handoff doc. `src/client/index.html` is
currently just a placeholder proving the server/static-file loop works.

Suggested next step: build the mic entry form as a vertical slice first (it's
simpler than the dashboard) to validate the full round trip — form → API →
DB → back — before tackling the dashboard's search/filter/auto-refresh/photo
gallery.

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
