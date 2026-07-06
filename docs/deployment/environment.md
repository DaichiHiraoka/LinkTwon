# Environment Management

This repository uses service-scoped environment files. Production and staging secrets must be injected by the deployment platform and must not be committed.

## Files

Tracked:

- `.env.example`: repository-level pointer to service-specific files.
- `backend/.env.example`, `frontend/.env.example`, `frontend-admin/.env.example`, `partner-portals/.env.example`: variable specifications.
- `*/.env.development`: non-secret local defaults.
- `*/.env.test`: non-secret test defaults.

Ignored:

- `.env`
- `.env.local`
- `.env.*.local`
- `.env.staging`
- `.env.production`

## Environments

- `development`: local commands use committed `.env.development` plus optional `.env.development.local`.
- `test`: test commands use committed `.env.test`.
- `staging`: no repository env file is required. Inject variables from the staging deployment service, then run `build:staging`.
- `production`: no repository env file is required. Inject variables from Render, Vercel, Aiven, or the relevant secret manager.

The backend resolves `APP_ENV` from `APP_ENV` or `NODE_ENV`. It loads env files only for `development` and `test` unless `LOAD_ENV_FILES=true` is set explicitly.

Vite apps use Vite modes:

- `vite`: development
- `vite build --mode test`: test build used by repository tests
- `vite build --mode staging`: staging build
- `vite build`: production build

## Local Setup

Install dependencies:

```powershell
npm run setup
```

Start every local service:

```powershell
npm run dev
```

Service ports stay unchanged:

- backend: `http://localhost:3000`
- frontend: `http://localhost:5173`
- frontend-admin: `http://localhost:5174`
- event portal: `http://localhost:5181`
- store portal: `http://localhost:5182`

Create `.env.development.local` only when a developer needs private local overrides. Start from the service `.env.example`, not from staging or production values. Generic `.env.local` is still ignored, but mode-specific files take precedence so stale generic values do not change development/test defaults.

## Commands

```powershell
npm run env:check
npm test
npm run build
npm run build:staging
```

`npm test` uses test modes and does not require production URLs. `npm run build` and `npm run build:staging` require the public frontend API URL to be injected.

## Backend Variables

Required in production and staging:

- `APP_ENV`: `production` or `staging`.
- `NODE_ENV`: use `production` on Render.
- `PORT`: service port, integer `1..65535`.
- `DB_CLIENT`: `mysql`.
- `DATABASE_URL`: MySQL URL from Aiven, with SSL settings when required.
- `JWT_SECRET`: at least 32 characters.
- `FRONTEND_ORIGIN` or `FRONTEND_ORIGIN_PATTERNS`: allowed browser origins. Use comma-separated exact origins or anchored regex patterns.
- `FRONTEND_BASE_URL`: public user frontend URL for email links.
- `MAIL_DRIVER`: `smtp`, `resend`, `outbox`, `console`, or `none`.
- `SMTP_HOST`, `SMTP_FROM`: required when `MAIL_DRIVER=smtp`.
- `RESEND_API_KEY`: required when `MAIL_DRIVER=resend`.

Optional backend variables:

- `JWT_EXPIRES_IN`
- `DB_CONNECTION_LIMIT`
- `MYSQL_SSL`
- `MYSQL_SSL_REJECT_UNAUTHORIZED`
- `MYSQL_SSL_CA`
- `AUTO_SEED_DEMO_DATA`
- `DEFAULT_ADMIN_ID`
- `DEFAULT_ADMIN_PASSWORD`
- `DEMO_USER_EMAIL`
- `DEMO_USER_PASSWORD`
- `EMAIL_VERIFICATION_EXPIRES_MINUTES`
- `PASSWORD_RESET_EXPIRES_MINUTES`
- `TRANSLATION_PROVIDER`: `mock` or `deepl`. Defaults to `deepl` only when `DEEPL_API_KEY` is present.
- `DEEPL_API_KEY`: required when `TRANSLATION_PROVIDER=deepl`.
- `DEEPL_API_URL`: defaults to `https://api-free.deepl.com/v2/translate`.
- `TRANSLATION_REFRESH_KEY`: optional secret for `/api/translations/translate` and `/api/translations/refresh`.
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_TLS_REJECT_UNAUTHORIZED`
- `RESEND_API_KEY`

Do not expose backend secrets through any `VITE_` variable.

## Frontend Variables

`frontend` and `frontend-admin`:

- `VITE_API_BASE_URL`: public backend API URL. Required for staging and production builds.
- `VITE_PROXY_TARGET`: local Vite proxy target. Development and test default to `http://127.0.0.1:3000`.

Only public values may use the `VITE_` prefix. Do not put database URLs, JWT secrets, API tokens, or SMTP credentials in Vite variables.
Browser-publishable provider keys may be exposed only when their variable names make that explicit, for example `VITE_*_PUBLISHABLE_KEY`, `VITE_*_PUBLIC_KEY`, or `VITE_*_ANON_KEY`.

## Partner Portal Variables

- `APP_ENV`: `development`, `test`, `staging`, or `production`.
- `PARTNER_APP_ROLE`: `event` or `store`; local scripts set this automatically.
- `PORT`: portal port.
- `PARTNER_DB_PATH` or `PARTNER_SQLITE_PATH`: local SQLite path.
- `PARTNER_REFRESH_KEY`: optional secret for translation refresh.
- `TRANSLATION_API_URL`: optional external translation API URL. For shared backend cache, use the backend `/api/translations/translate` URL.
- `TRANSLATION_API_TOKEN`: optional external translation API token. When pointing at the backend translation endpoint, set this to the backend `TRANSLATION_REFRESH_KEY`.
- `TRANSLATION_PROVIDER`: display/provider label.

## Deployment

Render backend:

- Set the backend variables listed above in Render.
- Do not upload `.env.production`.
- Use `npm start` from `backend/`.
- Run `npm --prefix backend run db:migrate:mysql` with Aiven variables injected.

Vercel frontend-admin:

- Set `VITE_API_BASE_URL` to the Render backend public URL.
- Build command: `npm run build`.
- Output directory: `dist`.

Staging:

- Use the same variable names as production, with staging values in the staging platform environment.
- Run `npm run build:staging` for Vite apps.

## Adding Variables

1. Add the variable to the owning service only.
2. Add validation in `backend/config/env.js`, `partner-portals/config/env.js`, or `scripts/checkViteEnv.mjs`.
3. Add it to the service `.env.example`.
4. Add non-secret defaults to `.env.development` and `.env.test` only when safe.
5. Update this document.

## Secret Leakage Response

If a real secret was committed or pasted into a shared log:

1. Rotate the secret at the issuing service.
2. Update Render, Vercel, Aiven, or the relevant secret manager.
3. Inspect Git history before deciding whether history rewriting is necessary.
4. Do not rely on `.gitignore` to protect a file that is already tracked.
