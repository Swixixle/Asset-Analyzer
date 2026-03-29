# Security audit triage — 2026-03-28

Automated dependency scans and manual follow-ups for the Debrief repo.

## npm (`npm audit`)

### Before remediation

Six issues reported (1 moderate, 5 high): transitive `brace-expansion`, `flatted`, `minimatch`, `path-to-regexp`, `picomatch`, and direct `nodemailer` (≤8.0.3).

### Actions taken

1. Ran `npm audit fix` — resolved all issues that did not require breaking changes.
2. Bumped **`nodemailer`** from `^6.10.0` to **`^8.0.4`** in `package.json` (addresses high-severity advisories; small breaking-change risk — verify email flows after upgrade).
3. Ran `npm install` to refresh `package-lock.json`.

### After remediation

`npm audit` reports **0 vulnerabilities** (verified 2026-03-28).

### Manual / `--force` not applied

None remaining after the steps above. Re-run `npm audit` after future dependency changes.

---

## Python (`pip-audit`)

Run: `.venv/bin/pip-audit` (or install `pip-audit` in the active environment).

### Finding

| Severity | Package  | Version | ID          | Notes |
|----------|----------|---------|-------------|--------|
| (see DB) | pygments | 2.19.2  | CVE-2026-4539 | **No fixed release on PyPI** at audit time (latest listed was 2.19.2). Transitive via `rich`. |

### Recommended action

- Track [Pygments PyPI](https://pypi.org/project/Pygments/) and **`pip install -U pygments`** when a fix version ships.
- Optionally re-run `pip-audit` in CI on lockfiles or editable installs.

### Noise

`pip-audit` may report *Dependency not found on PyPI: program-totality-analyzer* when the local package name in `.egg-info` is stale. Editable install should use **`debrief-analyzer`** per `pyproject.toml`; reinstall with `pip install -e .` if needed.

---

## CodeQL-oriented hardening (2026-03-28)

Three recurring alert classes were addressed application-wide:

1. **Missing rate limiting** — Added `express-rate-limit` with `server/middleware/rateLimiter.ts` (`apiLimiter`, `heavyLimiter`, `authLimiter`, and `spaFallbackLimiter` for the production SPA index fallback). `app.use("/api", apiLimiter)` in `server/index.ts` covers JSON API traffic; `heavyLimiter` is applied to analysis/ingest/queue-style routes; `authLimiter` to admin, API keys, and Stripe checkout. `/api/billing/webhook` and `/api/webhooks/github` are excluded from the global API limiter so bursty signed webhooks are not blocked. Vitest and `DISABLE_RATE_LIMITS=1` skip these limiters.

2. **Incomplete URL host checks** — Replaced loose substring / `endsWith("foo.com")` checks with registrable-host rules in `shared/urlHost.ts` (`isHostnameUnderRoot`, etc.), used from `shared/cloneAnalyzeUrl.ts` and `server/ingestion/ingest.ts`, plus GitHub URL validation in `server/routes.ts`. Clone operations use the parsed canonical `URL.href` after validation.

3. **Path traversal on ingest uploads** — Added `server/utils/pathSanitizer.ts` and `assertResolvedPathUnderBase` so multer `file.path` must resolve under the configured upload directory before ingest or transcription.

Re-run CodeQL after merge to confirm alert clearance.

---

## Review cadence

- **npm:** weekly or on any dependency PR.
- **Python:** monthly or when bumping `pyproject.toml` dependencies.

---

## Pygments (via `rich`) — CVE watch

- `rich` depends on `pygments` for syntax highlighting.
- Pygments has had exploitable CVEs in the past (e.g. ReDoS via crafted input).
- Our exposure: any code path that passes untrusted repo content through `rich`
  syntax highlighting is a potential vector.

**Current status:** `pip-audit` reported **CVE-2026-4539** for Pygments 2.19.2 (transitive via `rich`) as of 2026-03-28; confirm PyPI/OSV state with the commands below — there may still be no patched wheel. Monitoring required. (See also *Python (`pip-audit`)* above.)

**Check command:**

```bash
pip index versions pygments
pip-audit --vulnerability-service osv 2>/dev/null | grep -i pygment
```

**Action on new CVE:**

1. Check if our usage involves untrusted input (if not, low urgency)
2. Pin or upgrade `rich` / `pygments` in `pyproject.toml` or requirements
3. Run `pytest server/analyzer/tests/` to confirm nothing breaks
4. Update this section with CVE ID and resolution date
