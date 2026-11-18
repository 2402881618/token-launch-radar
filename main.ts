// The token radar's entry point (Node 22+, standard library only).
//
// It reads the sealed snapshot from /input/snapshot.json (or --input <file|dir>), scores every
// pre-token protocol with the model in lib/model.ts, writes the ranked board to /output/board.json,
// and copies this repository's dashboard/ and screenshots/ to /output. Last, it writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// The dashboard is a static page, no framework and no network: dashboard/index.html, dashboard/app.css
// and dashboard/app.js read /output/data.js, which this program writes from the same board.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot, MODEL } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The dossier's own caps: the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', process.env.INPUT_PATH ?? '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? process.env.OUTPUT_PATH ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot, MODEL);

// The board's own self-check runs before anything is written: a board that would fail the gate
// never reaches the output directory.
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

// The dashboard's source is checked for network before it is copied: a stray URL in a comment or
// an import would fail the dossier gate, and the dashboard is meant to make no request at all.
const dashboardDir = join(here, 'dashboard');
const dashboardNames = readdirSync(dashboardDir).sort().filter((n) => n.endsWith('.html') || n.endsWith('.css') || n.endsWith('.js'));
const dashboardBytes = dashboardNames.reduce((n, name) => n + statSync(join(dashboardDir, name)).size, 0);
for (const name of dashboardNames) {
  if (/https?:\/\//.test(readFileSync(join(dashboardDir, name), 'utf8'))) {
    process.stderr.write(`token radar: dashboard/${name} mentions a URL\n`);
    process.exit(1);
  }
}
if (dashboardBytes > 64 * 1024) {
  process.stderr.write(`token radar: dashboard source is ${dashboardBytes} bytes: the judge reads it whole only under 64 KiB\n`);
  process.exit(1);
}

// A fresh output directory every run, so two runs of the same snapshot write the same bytes.
// Clear only the contents of `out`, never `out` itself: in the grader's container /output is a
// mounted volume, and removing the mount point itself fails with EBUSY ("Device or resource busy")
// before anything is written — that is what failed the dev round's run_completes check.
mkdirSync(out, { recursive: true });
for (const name of readdirSync(out)) {
  rmSync(join(out, name), { recursive: true, force: true });
}
mkdirSync(join(out, 'dashboard'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });

// The board: one JSON object with the ranks, the model behind each rank, and the farm plans.
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board, model_version: 'radar-2', as_of: snapshot.as_of })}\n`);
// The dashboard: its own source, and the dataset as one script, so the page needs no network.
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

copyFiles(dashboardDir, join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.set_aside_size} set aside, ${radar.live_size} live)\n` +
    `token radar: top implied $${board[0]!.implied_value_usd} (${board[0]!.name}); board ${statSync(join(out, 'board.json')).size} bytes, dashboard ${dashboardBytes} bytes, ${shots.length} screenshots\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (${dashboardNames.length} files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
