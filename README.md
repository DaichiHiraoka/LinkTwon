# LinkTwon

Link Town is a local event and point platform with a Node.js/Express backend and a React/Vite frontend.

## デプロイ済み環境

| | URL |
|---|---|
| **フロントエンド** | https://link-twon.vercel.app/ |
| **バックエンド** | https://linktwon-backend.onrender.com |
| **イベント主催者アプリ** | https://linktown-event-portal.vercel.app/ |
| **商店アプリ** | https://linktown-store-portal.vercel.app/ |

詳細は [docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md) を参照。

## Development Flow

Use `dev` as the development integration branch. Do not change `main` directly for system changes.

- Work on `dev`, `feature/*`, `fix/*`, or `docs/*`.
- Merge or push validated work into `dev`.
- Promote `dev` to `main` only after tests and browser checks pass.

See [docs/BRANCHING_STRATEGY.md](docs/BRANCHING_STRATEGY.md) and [CONTRIBUTING.md](CONTRIBUTING.md) for the detailed workflow.

## Setup

```powershell
npm run setup
npm install
```

## Development

```powershell
npm run dev
```

Frontend: http://localhost:5173/

Admin frontend: http://localhost:5174/

Backend: http://localhost:3000/

Event organizer portal: http://localhost:5181/

Store portal: http://localhost:5182/

## Translation

Backend translations are cached in `content_translations`. Local development uses the `mock` provider unless `TRANSLATION_PROVIDER=deepl` and `DEEPL_API_KEY` are set.

DeepL confirmation flow:

```powershell
$env:TRANSLATION_PROVIDER="deepl"
$env:DEEPL_API_KEY="your-deepl-api-key"
npm --prefix backend run db:migrate:mysql
Invoke-RestMethod -Method Post "http://localhost:3000/api/translations/refresh"
Invoke-RestMethod -Method Post "http://localhost:3000/api/translations/refresh"
```

The first refresh should insert `provider='deepl'` rows into `content_translations`; the second refresh should return all matching rows as `skipped`, confirming the cache avoids repeat character usage.

## Deployment

- Backend: Render web service from `backend/`, start command `npm start`, health check `/health`.
- Admin frontend: Vercel project from `frontend-admin/`, output `dist`.
- Database: Aiven MySQL. Set `DB_CLIENT=mysql` and `DATABASE_URL` on Render, then run `npm --prefix backend run db:migrate:mysql`.
- Environment files are service-scoped. Local development uses committed `.env.development` defaults, tests use `.env.test`, and staging/production receive values from the deployment platform. See [Environment Management](docs/deployment/environment.md).

Required production environment variables:

- Render backend: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`, `FRONTEND_ORIGIN_PATTERNS`, `FRONTEND_BASE_URL`, SMTP settings.
- Vercel admin frontend: `VITE_API_BASE_URL=<Render backend public URL>`.

## Test

```powershell
npm test
```

Check environment configuration without starting services:

```powershell
npm run env:check
```
