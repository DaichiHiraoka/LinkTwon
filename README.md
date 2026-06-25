# LinkTwon

Link Town is a local event and point platform with a Node.js/Express backend and a React/Vite frontend.

## デプロイ済み環境

| | URL |
|---|---|
| **フロントエンド** | https://link-twon.vercel.app/ |
| **バックエンド** | https://linktwon-backend.onrender.com |

詳細は [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) を参照。

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

Backend: http://localhost:3000/

## Test

```powershell
npm test
```
