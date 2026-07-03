# pool-tracker

Public pool (8-ball) tracking site: every game since April 2017, imported from
the original spreadsheet and recorded through the site going forward.

- **Dashboard** — one layout, re-rendered under any scope: overall, `#/vs/<opponent>`,
  `#/at/<venue>`, `#/year/<yyyy>`. Rolling 10-game form, break advantage, win types,
  margins, streaks.
- **Sessions** — the full session log.
- **Story** — the 2018 "Pool vs Dad" report (PDF) with its claims re-graded live
  against the full dataset.
- **Record** — owner-only quick entry (PIN login), optimized for during-play use.

Viewing is public; only recording requires auth. The schema is tenant-ready
(every row carries `user_id`) but V1 is single-user.

## Stack

FastAPI + async SQLAlchemy (Postgres in prod, SQLite locally) · React + Vite ·
Docker Compose + Cloudflare Tunnel on the NAS. Mirrors the chipping/streetbrawl
deployment pattern.

## Local dev

```bash
# backend (from server/; uses sqlite at data/pool.db by default)
python -m venv .venv && .venv/Scripts/pip install -r server/requirements.txt
cd server && ../.venv/Scripts/python -m app.services.importer   # one-shot import, prints audit report
JWT_SECRET=dev OWNER_PIN=1234 ../.venv/Scripts/python -m uvicorn app.main:app --port 8000

# frontend (proxies /api to :8000)
cd ui/vite-project && npm install && npm run dev
```

`python -m app.services.importer --replace` wipes and re-imports the owner's data.

## Deploy

```bash
git push && ./deploy.sh
```

`deploy.sh` hard-resets the NAS checkout to `origin/main` and rebuilds the compose
stack (app + postgres + cloudflared) over SSH. Secrets live in the NAS `.env`
(see `.env.example`). With `AUTO_IMPORT=true` (default in compose) a fresh, empty
database seeds itself from `data/raw/pool.xlsx` on startup; a populated database
is never touched.

Cloudflare Tunnel: public hostname `pool.cashbaggins.dev` → service `http://app:8000`.

## Data

- `data/raw/pool.xlsx` — the original hand-kept workbook (2017–2025, 610 games).
  The importer's docstring documents every transformation it applies (alias
  merges, the fall-2017 balls-left column swap, cutthroat finish-place recovery).
- `data/raw/Pool vs Dad Breakdown Document 4.26.2018.pdf` — the 2018 report,
  served at `/api/report.pdf` for the Story page.
