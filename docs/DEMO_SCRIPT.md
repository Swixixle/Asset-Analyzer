# Debrief demo script (10 minutes)

A literal script for a live demo to an M&A advisor or CTO.

---

## Pre-demo checklist (run through this 30 min before every demo)

- [ ] `npm run dev` starts clean with no errors (API + SPA default **http://localhost:5000**)
- [ ] `DEBRIEF_CHAIN_ENABLED=true` in local `.env`
- [ ] `DEBRIEF_SCHEDULER_ENABLED=false` in local `.env` (manual control during demo)
- [ ] Test repo pre-analyzed and result cached (run it once before the call)
- [ ] Receipt JSON downloaded and inspectable in a text editor (`out/.../runs/<runId>/receipt.json`)
- [ ] `debrief verify-chain <TARGET_UUID>` returns clean output (only if you demo scheduled targets + DB/chain IDs)
- [ ] Ed25519 public key copied somewhere you can paste it (only if you demo signing/verify)
- [ ] No pending schema drift (`npm run db:push` run when changing tables)
- [ ] Browser tabs pre-opened: `http://localhost:5000/targets`, `http://localhost:5000/timeline/:targetId`, and your latest `receipt.json`

## What this demo proves

Debrief reads a target codebase and produces a plain-language brief with a
cryptographically signed receipt. The receipt is independently verifiable —
the buyer does not need to trust us, they can verify the hash chain themselves.
Each re-run produces a new receipt chained to the previous one, creating a
tamper-evident audit trail. This is what a $50K–$150K manual diligence engagement
cannot produce: a machine-verifiable, timestamped record of exactly what the
codebase contained at the moment of analysis.

## CLI spot-check (optional — script below is UI-first)

This script assumes you drive the **web UI** (same origin as API in dev). There are no `curl` steps.

To confirm artifacts exist before the call:

```bash
# repo root; Python env with `pip install -e .`
debrief analyze ./path-or-https-to-repo --output-dir ./out/pre-demo --no-llm
# Then open: ./out/pre-demo/runs/<runId>/ONEPAGER.md, DOSSIER.md, receipt.json
```

With API keys against a running server, browser calls use `X-Api-Key` or open-web mode per `docs/API.md` — not `Authorization: Bearer` unless you are using `/api/v1` with a `dk_*` key.

---

**Scene:** You are showing Debrief to someone evaluating it for tech due diligence.
They are not engineers. They are paying $50K–$150K per engagement today.

**Step 1 — The problem (90 seconds)**

- Say: *"When you're evaluating a company, what do you actually know about their codebase?"*
- Let them answer. The answer is usually: not much, or we hire a consultant.
- Say: *"This is what $50K buys you today."* Show a blank page.

**Step 2 — The run (60 seconds)**

- Paste the target repo URL. Hit analyze. Show the progress.
- Say: *"This takes about 2 minutes. It's reading every file."*

**Step 3 — The ONEPAGER (2 minutes)**

- Open ONEPAGER.md (from the run output folder or in-app report view).
- Say: *"This is what you hand to a CFO. Plain language, no code, under 3 minutes to read. These are the risk flags."*
- Read the risk flags section out loud.

**Step 4 — The DOSSIER (3 minutes)**

- Open DOSSIER.md.
- Find the same risk theme you just called out on the ONEPAGER (e.g. dependency exposure, TLS, secrets).
- Say: *"Every one of these is cited at a specific file and line number. This isn't a summary. It's a record."*
- Show the VERIFIED / INFERRED / UNKNOWN labels.
- Show the *"What it is NOT"* section.
- Say: *"The unknowns section is the most important part. Most tools hide what they don't know. This one shows you."*

**Step 5 — The receipt (90 seconds)**

- Open receipt.json.
- Say: *"This run record is hashed and timestamped. If anyone tampers with the dossier, the numbers no longer line up. You can drop this in the deal room."*

**Step 6 — The ask**

- *"We charge $5K per analysis. You're paying $50K today for something slower and less verifiable. Want to run it on something live?"*
