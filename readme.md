# Starred Repo Manager

Simple **local-only** web UI to bulk manage your GitHub starred repositories using the [`gh`](https://cli.github.com/) CLI.

Landing page source lives in [`docs/`](docs/) · [Product Hunt](https://www.producthunt.com/products/github-unstar)

## Prerequisites

1. [Node.js](https://nodejs.org/) 18+
2. [GitHub CLI](https://cli.github.com/) installed
3. Authenticated:

```bash
gh auth login
gh auth status
```

## Run

```bash
npm install
npm start
```

Or with auto-reload during development:

```bash
npm run dev
```

Open: http://127.0.0.1:3000

## How it works

1. **Load** — fetches all your starred repos via `gh api --paginate`
2. **Filter** — search, hide archived/forks, and sort client-side
3. **Stage** — tick repos to stage them; the staged list persists in `localStorage` across reloads
4. **Review** — open the staged drawer and review before committing
5. **Commit** — unstars in chunks of 10 with a progress bar; any failures stay staged so you can retry

## Features

- List all starred repos (paginated via `gh api`)
- Search / filter (archived, forks)
- Sort by starred date, name, stars, last push
- Stage → review → commit bulk unstar
- Mobile-friendly
- Uses your existing `gh` auth — no tokens in the app

## Project structure

- `server.js` — Express server + API (`/api/status`, `/api/starred`, `/api/unstar`, `/api/star`)
- `app/` — web UI (vanilla HTML/CSS/JS)
- `docs/` — landing page (Product Hunt badge, Umami analytics)

## Notes

- Binds to `127.0.0.1` only
- The UI sends unstar commits in chunks of 10; the server calls `DELETE /user/starred/{owner}/{repo}` sequentially to avoid rate spikes
- Large star lists (1000+) may take a bit on first load
