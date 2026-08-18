# Contributing to Mic Plot

Thanks for taking a look. This project is early — the backend API and
database schema are built and tested; the frontend (the mic-entry form and
dashboard) is not yet, so that's the highest-value place to help right now.

## Getting set up

```bash
git clone <this repo>
cd mic-plot
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Or with Docker: `docker compose up --build`.

## Before opening a PR

- `npm run build` should pass (TypeScript strict mode is on).
- `npx drizzle-kit generate` should run cleanly if you touched
  `src/server/db/schema.ts` — commit the generated migration file(s)
  alongside your schema change.
- Keep the mic form and dashboard's behavior consistent with
  `README.md`'s data model notes and the design-system colors/typography —
  those choices (SQLite, org_id-from-day-one, mic_id as TEXT, the shared
  photo-storage interface) were deliberate, so if a PR needs to deviate from
  one, please explain why in the PR description rather than silently
  changing it.

## Project structure

See the "Project layout" section in `README.md`.

## Reporting bugs / requesting features

Open a GitHub issue. For bugs, include your `docker compose` vs. local dev
setup and the exact steps to reproduce.

## Code style

Plain TypeScript, no linter enforced yet (contributions to add one — e.g.
ESLint + Prettier — are welcome, just open an issue first to agree on config
before a large reformatting PR).
