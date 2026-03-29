# TypeScript Type Check Status

Internal engineering note (not end-user documentation). See also `docs/internal/CLEANUP_LOG.md` for repo maintenance history.

## Current State

TypeScript type checking is configured but not currently enforcing in CI. This document tracks known issues and resolution plan.

## Known Issues

The repository has pre-existing TypeScript type errors in the following areas:

### Areas with Type Issues
1. Client components (React)
2. API route handlers
3. Database schema types
4. Test files

## Resolution Plan

### Option A: Scoped Type Checking (Recommended)

Split type checking into scoped configs to isolate passing areas:

```
tsconfig.json              (base config)
tsconfig.server.json       (server-only, can be strict)
tsconfig.client.json       (client-only, can be strict)
tsconfig.tests.json        (tests, relaxed rules)
```

**Benefits:**
- Allows incremental strictness
- Prevents regressions in clean areas
- Clear ownership boundaries

**Implementation:**
1. Create scoped configs
2. Run `tsc -p tsconfig.server.json` in CI
3. Fix errors incrementally
4. Add `tsc -p tsconfig.client.json` when client is clean

### Option B: Explicit TODO with Known Issues List

Continue with current setup but document known issues:

```json
// In package.json
{
  "scripts": {
    "check": "tsc || echo 'WARNING: Type errors exist. See docs/internal/TYPECHECK_TODO.md'"
  }
}
```

**Benefits:**
- No config changes
- Honest about current state
- Simpler short-term

**Drawbacks:**
- Can't prevent regressions in passing areas
- No incremental progress tracking

## Current Approach

We're using **Option B** (Explicit TODO) as a pragmatic short-term solution.

### CI Behavior

The `check` script runs `tsc` but doesn't fail CI if errors exist. Instead:
- Errors are logged
- Warning message points to this document
- Known issues are tracked below

### Known Type Errors (as of 2026-02-17)

*Note: Run `npm run check 2>&1 | tee typecheck-output.txt` to populate this table with current error counts.*

This table will be updated when type checking is run in CI:

| File/Area | Error Count | Issue Type | Priority |
|-----------|-------------|------------|----------|
| *To be populated* | - | - | - |

**Action Item**: Run type check and update this table in a follow-up commit.

## Contributing

When fixing type errors:
1. Run `npm run check` before changes
2. Fix errors in your area
3. Update this document if error count changes
4. Don't introduce new errors

## Future Work

Once the codebase is cleaner:
1. Move to Option A (scoped configs)
2. Enable `noImplicitAny` globally
3. Add `tsc --noEmit` to pre-commit hooks
4. Require passing type check in CI

## Baseline — 2026-03-29

Error count: **1700** (from `npx tsc --noEmit 2>&1 | grep -c "error TS" || echo 0` at repo root).

Intent: CI should fail if this number increases.

## See Also

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [tsconfig.json](../../tsconfig.json)
- [CI Configuration](../../.github/workflows/)
