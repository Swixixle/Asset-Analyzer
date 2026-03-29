
# API.md

## Base URL

- Default: `http://localhost:5000/`
- Note: May be proxied in production; confirm deployment config.

## Authentication

- **API access:** Header `X-Api-Key` (API_KEY env var)
- **Admin endpoints:** Header `X-Admin-Key` (ADMIN_KEY env var)
- **GitHub webhook:** Header `X-Hub-Signature-256` (HMAC SHA-256, GITHUB_WEBHOOK_SECRET env var)
- **Conditional auth:**
  - Production: Missing API_KEY causes 500 "API authentication not configured"
  - Development: Missing API_KEY allows access
  - Admin: Production missing ADMIN_KEY causes 500 "Admin authentication not configured"; dev missing key allows access and logs `admin_unguarded`

## Rate Limiting

- Per endpoint, enforced by custom limiter functions:
  - `healthRateLimiter`, `projectApiRateLimiter`, `ciApiRateLimiter`, `dossierRateLimiter`, `adminAuthRateLimiter`, `evidenceBundleRateLimiter`, `webhookRateLimiter`
  - Test mode disables rate limits via `DISABLE_RATE_LIMITS`, `NODE_ENV=test`, or `ENV=TEST`

## Endpoints

### Health
- GET `/health` — Rate limited, no auth
- GET `/api/health` — Rate limited, API_KEY required in production for details

### Projects
- GET `/api/projects` — Rate limited, API_KEY required
- POST `/api/projects` — Rate limited, API_KEY required, body validated by zod schema
- GET `/api/projects/:id` — Rate limited, API_KEY required
- GET `/api/projects/:id/analysis` — Rate limited, API_KEY required
- POST `/api/projects/:id/analyze` — Rate limited, API_KEY required, triggers Python orchestration
- POST `/api/projects/analyze-replit` — Rate limited, API_KEY required, triggers Python orchestration

### Dossiers
- GET `/api/dossiers/lantern` — Rate limited, public, returns markdown

### Admin
- GET `/api/admin/analyzer-log` — Rate limited, ADMIN_KEY required
- POST `/api/admin/analyzer-log/clear` — Rate limited, ADMIN_KEY required
- POST `/api/admin/reset-analyzer` — Rate limited, ADMIN_KEY required

### Evidence Bundles
- POST `/api/certificates` — Rate limited, API_KEY required, body validated by zod schema
- GET `/api/certificates/:id/evidence-bundle.json` — Rate limited, API_KEY required
- GET `/api/certificates/:id` — Rate limited, API_KEY required
- POST `/api/certificates/verify` — Rate limited, public
- GET `/api/certificates` — Rate limited, API_KEY required, query param `tenant_id` required

### Webhooks
- POST `/api/webhooks/github` — Rate limited, HMAC signature required, deduplication via `checkAndRecordDelivery()`

### CI
- GET `/api/ci/runs` — Rate limited, API_KEY required, query params `owner`, `repo` required
- GET `/api/ci/runs/:id` — Rate limited, API_KEY required
- POST `/api/ci/enqueue` — Rate limited, API_KEY required, body fields validated
- POST `/api/ci/worker/tick` — Rate limited, API_KEY required
- GET `/api/ci/health` — Rate limited, API_KEY required

## Request/Response Shapes

- Request bodies validated by zod schemas in `shared/routes.ts`.
- Responses:
  - Projects: DB row shape (see DATA_MODEL)
  - Analyses: DB row shape (see DATA_MODEL)
  - CI runs/jobs: DB row shape (see DATA_MODEL)
  - Certificates: DB row shape (see DATA_MODEL)
  - Errors: `{ error: "..." }`, `{ message: "..." }`, `{ ok: false, error: "..." }` (documented as-is)

## Special Notes

- `/api/health` returns 503 on error and includes a `status` + `checks` object. In prod, internal errors may be masked unless authenticated.
- `/api/dossiers/lantern` returns markdown (`text/markdown`) and is public but rate limited.
- Webhook route includes replay deduplication using `checkAndRecordDelivery()` and returns 202 for deduped replays and ignored events.
- `/api/certificates/verify` is public (no `requireAuth`) but rate limited.
## Code Pointers

- `server/routes.ts` — All route definitions, auth, rate limiting, Python orchestration
- `shared/routes.ts` — Route schemas, zod validation
- `server/storage.ts` — DB access, certificate storage
- `server/db.ts` — DB connection, env usage
- `shared/schema.ts` — Drizzle table definitions
- `drizzle.config.ts` — Migration config
- `.env.example` — Environment variable reference
- `server/analyzer/analyzer_cli.py` — Python entrypoint
- Request: JSON body (fields as per zod schema in server/routes.ts)
- Returns: Project object (see Data Model)

### /api/projects/:id [GET]
- Admin Key required
- Request: URL param `id`
- Returns: Project object (see Data Model)

### /api/projects/:id [PUT]
- Admin Key required
- Request: URL param `id`, JSON body
- Returns: Updated project object (see Data Model)

### /api/projects/:id [DELETE]
- Admin Key required
- Request: URL param `id`
- Returns: `{ deleted: true }`

### /api/analyses/:id [GET]
- Admin Key required
- Request: URL param `id`
- Returns: Analysis object (see Data Model)

### /api/analyses [POST]
- Admin Key required
- Request: JSON body (fields as per zod schema in server/routes.ts)
- Returns: Analysis object (see Data Model)

### /api/ci/runs [GET]
- Admin Key required
- Returns: Array of CI run objects (see Data Model)

### /api/ci/enqueue [POST]
- Admin Key required
- Request: JSON body (fields as per zod schema in server/routes.ts)
- Returns: `{ runId, status }`

### /api/ci/worker/tick [POST]
- Admin Key required
- Returns: `{ status }`

### /api/operate/:runId [GET]
- Admin Key required
- Request: URL param `runId`
- Returns: Raw operate.json content

### /api/dossier/:runId [GET]
- Admin Key required
- Request: URL param `runId`
- Returns: Raw DOSSIER.md content

### /api/coverage/:runId [GET]
- Admin Key required
- Request: URL param `runId`
- Returns: Raw coverage.json content

### /api/unknowns/:runId [GET]
- Admin Key required
- Request: URL param `runId`
- Returns: Raw known_unknowns.json content

### /api/claims/:runId [GET]
- Admin Key required
- Request: URL param `runId`
- Returns: Raw claims.json content

### /api/target_howto/:runId [GET]
- Admin Key required
- Request: URL param `runId`
- Returns: Raw target_howto.json content

## Error Conventions (Global)
- 400: Validation error (zod schema)
- 401: Unauthorized (missing or invalid admin key)
- 404: Not found (invalid ID or runId)
- 429: Rate limit exceeded (admin endpoints)
- 500: Internal server error

## Data Model
See docs/DATA_MODEL.md for full schema.

## Code Pointers
- Server entry: server/index.ts
- Router: server/routes.ts
- Auth middleware: server/routes.ts (requireDevAdmin)
- DB schema: shared/schema.ts
- Migrations config: drizzle.config.ts
