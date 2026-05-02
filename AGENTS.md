# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is the 鲁港通 (LuGangTong) cross-border AI platform monorepo containing:
- **Frontend (`lugang-ai/`)**: Next.js 14 + Chakra UI app (FastGPT fork), port 3000 in dev
- **Backend (`lugang-connect-enterprise/`)**: Go/Gin API gateway (One API fork), port 8080 in dev

### Starting Infrastructure Services

Docker infrastructure (MongoDB, PostgreSQL+pgvector, Redis, etc.) is managed via:
```
cd lugang-ai/deploy/dev && docker compose up -d
```
Key containers: `mongo` (27017), `pg` (5432), `redis` (6379), `aiproxy` (3010), `sandbox` (3002), `fastgpt-plugin` (3003).

All infrastructure services must be running before the frontend dev server starts—the frontend crashes on startup if aiproxy/redis/mongo/pg are unavailable.

### Frontend (lugang-ai)

- **Install deps**: `cd lugang-ai && pnpm install --ignore-scripts && pnpm run postinstall`
  - The `prepare` script runs `husky install` which fails because `.git` is at workspace root, not in `lugang-ai/`. Use `--ignore-scripts` then manually run `postinstall`.
- **Dev server**: `cd lugang-ai && pnpm --filter=lugang-ai-app dev` (port 3000)
- **Lint**: `cd lugang-ai && pnpm lint` (0 errors, ~75 warnings is normal)
- **Tests**: `cd lugang-ai && pnpm vitest run --config vitest.simple.config.mts`
  - The simple config does NOT require database connections. Some test files in the glob pattern require MongoDB (via `mongodb-memory-server`) and will timeout—these failures are pre-existing.
- **Env config**: Copy `projects/app/.env.template` → `projects/app/.env.local`. Update:
  - MongoDB database name from `fastgpt` to `lugang_ai`
  - AIPROXY_API_ENDPOINT from `https://` to `http://` for local dev

### Backend (lugang-connect-enterprise)

- **Build**: `cd lugang-connect-enterprise && CGO_ENABLED=1 go build -o lugang-enterprise .`
- **Web frontend**: The Go binary embeds `web/build/*`. Build it first:
  ```
  cd lugang-connect-enterprise/web/berry && npm install --legacy-peer-deps
  DISABLE_ESLINT_PLUGIN=true npm run build
  mkdir -p ../build && cp -r build/* ../build/
  ```
- **Run**: Set `PORT=8080` and do NOT set `SQL_DSN` to use SQLite for local dev. If `SQL_DSN` is set to any non-empty, non-`postgres://` value, the backend treats it as a MySQL DSN.
  ```
  PORT=8080 GIN_MODE=debug THEME=berry SESSION_SECRET=test go run main.go
  ```
- **Tests**: `cd lugang-connect-enterprise && go test ./...` (1 pre-existing failure in `common/image`)
- **Default login**: username `root`, password `123456` (auto-created on first run with SQLite)

### Gotchas

- The backend `.env.local` file is auto-loaded by `godotenv/autoload`. If it sets `SQL_DSN` to a `file:...` SQLite path, the backend incorrectly tries MySQL. Either unset `SQL_DSN` or leave it empty for SQLite.
- Frontend default root password is `123456` (set via `DEFAULT_ROOT_PSW` in `.env.local`).
- Package manager is strictly `pnpm` for the frontend monorepo.
