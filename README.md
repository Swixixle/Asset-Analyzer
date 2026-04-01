# Debrief

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**You built it with AI. Now find out what it actually is.**

Debrief analyzes any codebase — GitHub repo, archive, local path, zip — and produces a plain-language report of what it does, what it depends on, where it's vulnerable, and what its API surface looks like. Every report is cryptographically signed so the output can't be quietly altered after the fact.

The primary audience is developers who built something with AI assistance and want an honest account of what they actually have.

---

## What it produces

- **Plain-language brief** — what the codebase does in plain English, structured in 8 sections
- **Dependency posture** — what's outdated, what's vulnerable, what's missing
- **Security surface** — secrets scan (TruffleHog), auth patterns, exposed endpoints
- **API surface map** — every route, method, and parameter
- **Signed receipt** — Ed25519 signature over the report content so it's tamper-evident
- **Time-based evidence trail** — scheduled re-analysis with gap and anomaly detection

---

## Live

> Add your deployed URL here once Render is live

**Verify any receipt:** `/verify`

---

## Quickstart

```bash
npm install

python3 -m venv .venv
.venv/bin/pip install -e .

cp .env.example .env
# Required: OPENAI_API_KEY or ANTHROPIC_API_KEY
# Required for full web app: DATABASE_URL
# Optional: REDIS_URL for BullMQ queue

docker compose up -d   # Postgres + Redis

npm run dev            # Express + Vite client at http://localhost:5000

# CLI — analyze any repo
debrief analyze https://github.com/user/repo --output-dir ./out/run --mode learner
```

---

## Modes

**Learner mode** (primary) — produces a plain-language 8-section report for developers who built something with AI assistance and don't fully understand what they have. This is the face of the product.

**Open web** — set `DEBRIEF_OPEN_WEB=1` so the SPA calls the API without a shared key (still rate-limited).

**Auth (Clerk)** — optional sign-in for hosted multi-tenant setups.

**Desktop (Tauri)** — local shell around the same API:
```bash
npm run dev          # terminal 1 — API on PORT (default 5000)
npm run desktop:dev  # terminal 2 — Tauri dev window
```

---

## How it was built and what broke along the way

This is a real system with 278+ commits. These are the actual failure modes encountered and what was done about them.

**57 CodeQL high-severity alerts on first security scan.** Early development prioritized features over hardening. A dedicated security pass resolved all 57 alerts — input validation, dependency pinning, secrets handling. The `RISKS_AND_GAPS.md` in the repo documents what remains and why.

**Duplicate environment variable naming across legacy and current code.** The codebase went through several naming phases (rest-express → program-totality-analyzer → debrief). Environment variables accumulated with overlapping names pointing to the same values. A keys/secrets simplification pass collapsed these into a single coherent set with auto-generation on first boot for Ed25519 keypairs and API keys.

**BullMQ queue retention caused memory pressure on Render's free Redis tier.** Default job retention kept every completed and failed job indefinitely. On a free Redis instance with ~25MB limit, the queue filled up and started rejecting new jobs silently. Retention was tightened to keep only recent jobs with explicit TTLs.

**TruffleHog integration found real secrets in test fixtures.** Adding secrets scanning as part of the analysis pipeline immediately caught hardcoded test credentials that had been sitting in fixture files. Those were rotated and the scanner was added to the pre-analysis checklist.

**Where it still breaks:**
- Large monorepos (>500 files) hit analysis timeouts on the free Render tier — chunking is partially implemented but not complete
- The Tauri desktop layer works for local paths but hasn't been tested on Windows
- Education Mode's cognitive graph visualization is built but the LLM receptionist quality-check post-processing occasionally strips valid technical terms as "hedges"
- Billing infrastructure (Stripe) is wired but gated behind `DEBRIEF_BILLING_ACTIVE=0` — not production-ready

---

## Stack

| Layer | Tech |
|---|---|
| API | Node.js, Express, TypeScript |
| Analyzer | Python 3.11, Typer CLI (`debrief`) |
| Database | PostgreSQL via Drizzle ORM |
| Queue | BullMQ + Redis |
| Signing | Ed25519 + content hashing |
| Secrets scan | TruffleHog |
| Auth | Clerk (optional) |
| Desktop | Tauri |
| Deployment | Render via render.yaml |
| Commit count | 278+ |

---

## Repo layout

| Path | Purpose |
|---|---|
| `client/` | React UI, Vite, `src-tauri/` (desktop) |
| `server/` | Express API, BullMQ worker, Python analyzer |
| `shared/` | Drizzle schema, routes, JSON schemas |
| `docs/` | Architecture, configuration, deployment, market context |
| `extensions/`, `integrations/` | VS Code extension, editor and bot stubs |
| `out/` | Local output — gitignored |

---

## Input types

GitHub, GitLab, Bitbucket, Replit, local folder (when enabled), zip upload, URL surface scan, audio (Whisper), pasted text, Notion (public page).

---

## License

MIT — Copyright (c) 2026 Nikodemus Systems.
