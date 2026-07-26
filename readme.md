# Starred Repo Manager

Simple **local-only** web UI to bulk manage your GitHub starred repositories using the [`gh`](https://cli.github.com/) CLI.

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

Open: http://127.0.0.1:3000

## Features

- List all starred repos (paginated via `gh api`)
- Search / filter (archived, forks)
- Sort by starred date, name, stars, last push
- Multi-select + bulk unstar
- Uses your existing `gh` auth — no tokens in the app

## Notes

- Binds to `127.0.0.1` only
- Bulk unstar calls `DELETE /user/starred/{owner}/{repo}` sequentially to avoid rate spikes
- Large star lists (1000+) may take a bit on first load