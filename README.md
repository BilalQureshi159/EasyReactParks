# EasyTicketing (parkflow-platform)

Multi-tenant park ticketing SaaS — Express + Prisma/MySQL backend, React/Vite frontend.

## Setup

```bash
npm install
npm run db:push -w backend
npm run db:seed -w backend
npm run dev
```

## GitHub sync

This repo uses a **post-commit hook** to push to your private GitHub repo after each commit.

- First-time setup: see `scripts/setup-github.ps1`
- Manual push: `git push`

**Do not commit** `.env` files — they are gitignored.
# EasyReactParks
