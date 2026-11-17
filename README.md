# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/bounty/token-radar-01)](https://make.fun/bounty/token-radar-01)

A token launch radar for make.fun's token-radar-01 bounty. It ranks pre-token
protocols by implied value and shows how to farm each one.

## How it works

`main.ts` (Node 22, standard library only) reads a sealed DefiLlama snapshot
of 758 protocols and writes:

- `board.json` — 198 ranked rows. Every one of the snapshot's 40 watchlist
  protocols is covered, plus 158 more rankable protocols found below the
  $50M floor. Ranks are 1–198 with non-increasing implied values.
- `dashboard/` — a no-network dashboard: sortable/filterable board, detail
  drawer per protocol, live-token and set-aside tabs, and a model sandbox.
- `screenshots/` — board, detail, filtered, and model views.
- `dossier.json` — built with `buildDossier` from `vendor/makefun-board.ts`.

## Value model

`implied = TVL × category multiple × growth × maturity`

The category multiple is the median MC/TVL of live-token peers in the same
category, taken from the snapshot itself (each peer ratio capped at 2.0,
minimum 3 peers, shrinkage toward the global median 0.169, clamped
[0.05, 0.80]). Growth is the protocol's 7-day TVL change clamped
[−60%, +120%]; maturity saturates at 3 years since first tracked. No
hardcoded list of names: the model derives everything from the snapshot's
own figures. See `lib/model.ts` for the full formula and calibration table.

Top 5 by implied value: Steakhouse Financial $399.0M, Sentora Curator
$388.7M, Gauntlet $237.7M, USDD $155.9M, Veda $132.3M.

## Farm plans

Each row carries 7 concrete steps generated from that protocol's own record:
its chains set the gas, its TVL sets the capital ($50–500), its age sets the
hold (30–60 days), its growth sets the momentum note, plus category-specific
actions. Every step states what it costs and how long it takes.

## Verify

```sh
node --experimental-strip-types scripts/validate-gate.ts
```

This re-implements the competition's 7 gate checks (dashboard files, board,
rank order, watchlist coverage, farm steps, screenshots, dossier match)
against a fresh `out/` build.
