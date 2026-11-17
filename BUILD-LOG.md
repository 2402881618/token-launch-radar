# Token Radar — build log

Competition token-radar-01 (deadline 2026-12-14 10:00 UTC). Account @calm-walrus-88 already registered; this entry is built, not submitted. Work directory: `~/workspace/make-fun/token-radar-01/`; kit (read-only): `~/workspace/make-fun/token-radar-01-kit/`.

## What changed vs the starter, and why

### 1. The board: 198 rows, every rankable pre-token protocol (starter: 200)
- The starter ranks the 40 watchlist slugs plus the 160 biggest pre-token protocols below the floor — including wrapped, staked and bridged products of tokens that already trade ("Binance staked ETH", "Base Bridge", "CCIP"). This board applies the watchlist's own exclusion rule to the whole universe: pre-token AND not a wrapped/staked/bridged product, not a versioned pool, not an exchange product, not a CEX. Result: **198 rows** — all 40 watchlist slugs + 158 others.
- The 144 protocols set aside are shown in the dashboard's "Set aside" tab with the reason each one is not a launch of its own (42 CEX, 38 Liquid Staking, 28 Bridge, 15 Canonical Bridge, 11 versioned, 5 wrapped-named, 3 Liquid Restaking, 2 Restaked BTC). The starter hid them.
- **The watchlist is not exhaustive**: 20 rankable protocols sit above the $50M floor and are not on it — including the #2 row, Sentora Curator ($2.76B TVL). The dashboard says so in a stat ("20 above the floor, off the watchlist") instead of calling every non-watchlist row "below the floor". An early version of this build made exactly that mistake; it was caught by counting and fixed.

### 2. The value model: category multiples calibrated from the snapshot's own live peers (starter: flat 0.25)
- `implied = TVL × category multiple × growth × maturity`, all from the snapshot's own figures; no name is ever special-cased.
- **Category multiple**: the median market-cap / TVL of the live-token protocols in the same category, shrunk toward the global median (four prior observations), clamped to [0.05, 0.80]. Two guards keep one protocol from setting a whole category: every peer's ratio is capped at 2.0 before the median, and a category with fewer than three live peers takes the global median. This mattered: one live peer's ratio in this snapshot is 400, and Risk Curators had a single peer at 2.975 — without the guards the top of the board was set by single outliers (first build: Steakhouse $1.72B on a 0.73 multiple; fixed build: $399M on the honest global 0.169).
- **Growth**: 1 + clamp(7-day TVL change, −60%, +120%) / 100 × 0.5. The clamp matters: one protocol grew 4,448% in seven days.
- **Maturity**: 0.55 + 0.45 × √(min(age, 3 years) / 3 years); unknown age counts as one year. It rises fast in the first year, then saturates.
- The dashboard shows the whole calibration table (category, live peers, their median ratio, the multiple used), so the judge can see the model, not just its output.

### 3. Farm plans: 7 steps, generated from each protocol's own record (starter: 6 template steps)
- Chain sets the gas (Ethereum $8, Solana $1, L2s $1, default $2); TVL sets the capital ($500 / $250 / $100 / $50); age sets the hold (60 / 45 / 30 days); seven-day growth sets the momentum note. Category-specific actions cover 14 categories. A second-chain step names the protocol's second chain when it has one. Every step carries a cost and a time; all 1,386 steps are 124–239 characters (gate allows 20–600).

### 4. Dashboard: dark radar theme, new views and a model sandbox (starter: light theme, board only)
- Tabs: Pre-token (198) / Live token (24 by market cap, with MC/TVL) / Set aside (144 with reasons) / Model & calibration.
- Search, category filter, chain filter, five sort orders, sortable column headers, hash deep-linking (`#tab=`, `#q=`, `#cat=`, `#chain=`, `#sort=`, `#p=`), detail drawer per protocol (model breakdown, why-this-rank, 7-step farm plan).
- **Model sandbox**: growth-weight and maturity-floor sliders re-rank the board live with the same functions `main.ts` uses; Reset returns the published board.
- Source: index.html 6.5 KB + app.css 5.6 KB + app.js 15.6 KB = **27,692 bytes** (judge reads it whole under 64 KiB). No network anywhere: no `http://` or `https://` in any HTML attribute, CSS file or JS import. (The snapshot's own `source` string, which contains a URL, appears only as visible text in the header and as a data value in `data.js` — the same as the starter.)

### 5. Files written by hand, not copied
- `main.ts`, `lib/model.ts`, `dashboard/index.html`, `dashboard/app.css`, `dashboard/app.js`, `scripts/validate-gate.ts`, `scripts/shoot.mjs` are all my own code. Copied verbatim from the kit, as its rules instruct: `LICENSE` and `vendor/makefun-board.ts` (the kit's dossier library). The starter's files were read as reference only.

## Verification
- `node --experimental-strip-types scripts/validate-gate.ts out <snapshot>` implements the 7 gate checks from RULES.txt (dashboard_files, board_file, sorted_by_value, coverage, farm_steps, screenshots, dossier_matches incl. a byte-for-byte `buildDossier` rebuild). **All 7 pass.**
- The kit's `grade-local` does not apply to this competition: it exits saying the scorer and reference data are not published in the kit and the house grades it server-side — the same as RULES.txt says ("there is no local grade: the server grades every entry").
- **Determinism**: two `main.ts` runs into separate directories are byte-identical (`diff -r` clean).
- Screenshots rendered from the built dashboard with headless Chromium (Playwright, 1440×900): 1-board 155,076 B; 2-detail (Steakhouse Financial drawer) 240,405 B; 3-filtered (Lending, 16 of 198) 137,059 B; 4-model (calibration table) 97,592 B — all under the 512 KiB cap, all visually checked.
- Two screenshot bugs found and fixed during the build: (a) same-document hash navigation did not reload the page, so shots 2–4 duplicated shot 1 — fixed by giving each shot a fresh page; (b) long chain lists pushed the table's last column off-screen — fixed by truncating chains to 3 + "+N" and moving the watchlist badge inline.

## Board snapshot (as of 2026-11-14)
- 758 protocols; 342 record no token; 198 ranked (40 watchlist + 158 early); 144 set aside; 416 live (24 shown).
- Top 5 implied values: Steakhouse Financial $399.0M; Sentora Curator $388.7M; Gauntlet $237.7M; USDD $155.9M; Veda $132.3M. Bottom row: Nucleus $412,705.
- Board: 318,043 bytes. Dossier: 870,005 bytes (under the 1.5 MiB cap). `data.js`: 108,283 bytes.

## Still to do (main agent)
- Submission needs a public GitHub repo the user has not provided yet (or the source-bundle route). The entry's git repo is initialised in the work directory; it is not committed to a remote.
- The `check` pre-submit command (LICENSE, entrypoint, size caps, transcript gate) has not been run — it needs the repo + the session transcripts, which the main agent bundles at submit time.
- Nothing here touches the account keypair (`~/workspace/make-fun/makefun-keypair.json`) or the API credentials (`~/.makefun/credentials`).
