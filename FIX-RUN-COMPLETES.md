# Token Radar — dev-round `run_completes` failure: diagnosis and fix

## Symptom (2026-11-18 09:00 status check, submission 01a1e810-afc1-7571-b2a0-016648afcb8b)
- Dev-round scoring produced no provisional rate / win rate: `run_completes` failed.
- All other checks (repo, transcripts, audit, etc.) passed. Entry is in first-round-rejected state.
- Resubmission (round 2) is possible any time before the deadline **2026-12-14 10:00 UTC**.

## Root cause
`main.ts:71` (submitted commit `9aaec9e`) did this before writing anything:

```ts
if (existsSync(out)) rmSync(out, { recursive: true, force: true });
```

In the grader's container `/output` is a **mounted writable volume**. Removing the mount
point itself fails — `force: true` does not help — so the program crashed before writing
`board.json` / `dossier.json`. The kit's starter does not do this: it only `mkdirSync(out)`.

## Evidence (reproduced 2026-11-18, this machine, Node v24.22.1)
- Old code, output pointed at a tmpfs mount (same shape as the grader's `/output`):
  exit 1, `Error: , Unknown error: Device or resource busy '/tmp/mnt-old'`,
  thrown at `main.ts:71` (`rmSync`, errno -4094). Even an empty mount throws.
- Plain `node -e` test: `fs.rmSync(mountPoint, { recursive: true, force: true })` throws
  the same EBUSY error.
- Locally the bug is invisible: `/tmp/radar-out1` is an ordinary directory, so the same
  code ran in 0.3 s, exit 0, and two runs were byte-identical.

## Fix applied (workdir only — NOT committed, NOT pushed, NOT resubmitted)
`main.ts`: clear only the *contents* of the output directory, never the directory itself:

```ts
mkdirSync(out, { recursive: true });
for (const name of readdirSync(out)) {
  rmSync(join(out, name), { recursive: true, force: true });
}
```

## Verification of the fix (2026-11-18)
- Fixed code, output on a tmpfs mount: exit 0, full output written; a re-run into the
  same mount (stale contents present) also exit 0.
- Two runs into separate mounts: `diff -r` clean — still deterministic, as the grader
  requires (it runs the program twice and both runs must write the same bytes).
- `scripts/validate-gate.ts` on the fixed output: **all 7 gate checks PASS**
  (dashboard_files, board_file 198 rows, sorted_by_value, coverage 40/40,
  farm_steps, screenshots, dossier_matches).
- The other three make.fun entries were grepped for the same pattern
  (`rmSync`/`rmdirSync` on the output dir): best-game-01, github-core-clone-01 and
  tiny-chess-01 do not have it.

## What still needs the user
- Approve resubmitting round 2 (commit + push the fix, then kit `submit`). Nothing has
  been submitted yet; the submitted entry is still the old commit.
- Note the limits: at most 5 submissions per entrant per UTC day, 10 in all; this would
  be submission 2 for token-radar-01. The prize is $1,325; results by 2026-12-28.
