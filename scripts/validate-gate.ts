// The seven gate checks, as RULES.txt states them, run against a built /output:
//   dashboard_files, board_file, sorted_by_value, coverage, farm_steps, screenshots, dossier_matches
// Run: node --experimental-strip-types scripts/validate-gate.ts <out-dir> [snapshot.json]
// Exit 0 when all seven pass; otherwise the failing rows are printed and the exit is 1.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from '../vendor/makefun-board.ts';
import { parseSnapshot } from '../lib/model.ts';

const out = process.argv[2] ?? 'out';
const snapshotPath = process.argv[3] ?? '../make-fun/token-radar-01-kit/input/snapshot.json';
const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
const slugSet = new Set(snapshot.protocols.map((p) => p.slug));

const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail: string): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}

/** The width and height of a PNG or JPEG buffer, or null when the file is not a whole image. */
function imageSize(buf: Buffer): { w: number; h: number; kind: string } | null {
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), kind: 'png' };
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1]!;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5), kind: 'jpeg' };
      }
      i += 2 + len;
    }
  }
  return null;
}

/** Any http or https URL where the gate forbids one: an HTML attribute, a style body, an inline
 *  script's import, a CSS file, or a JS import, export, require or dynamic import. */
function networkIssue(name: string, text: string): string | null {
  if (name.endsWith('.html')) {
    const attr = text.match(/(?:src|href|action|poster|data|formaction|cite|background)\s*=\s*["']https?:\/\//i);
    if (attr !== null) return `${name}: an HTML attribute carries a URL`;
    const style = text.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) ?? [];
    for (const s of style) if (/https?:\/\//.test(s)) return `${name}: a <style> body carries a URL`;
    const script = text.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
    for (const s of script) if (/\b(import|require|from)\s*\(?\s*["']https?:\/\//.test(s)) return `${name}: an inline script imports a URL`;
  } else if (name.endsWith('.css')) {
    if (/https?:\/\//.test(text)) return `${name}: a CSS file carries a URL`;
  } else if (name.endsWith('.js')) {
    if (/\b(?:import|export|require)\b[^'"]*["']https?:\/\//.test(text) || /import\s*\(\s*["']https?:\/\//.test(text)) {
      return `${name}: a JS import carries a URL`;
    }
  }
  return null;
}

// 1. dashboard_files
{
  const dir = join(out, 'dashboard');
  const names = existsSync(dir) ? readdirSync(dir).filter((n) => !n.startsWith('.')) : [];
  const bytes = names.reduce((n, f) => n + statSync(join(dir, f)).size, 0);
  const hasHtml = names.includes('index.html');
  const css = names.filter((n) => n.endsWith('.css'));
  const js = names.filter((n) => n.endsWith('.js'));
  let issue: string | null = null;
  for (const n of names) {
    if (!/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(n)) { issue = `dashboard/${n}: an invalid name`; break; }
    const bad = networkIssue(n, readFileSync(join(dir, n), 'utf8'));
    if (bad !== null) { issue = bad; break; }
  }
  check('dashboard_files', hasHtml && css.length >= 1 && js.length >= 1 && names.length <= 400 && bytes <= 4 * 1024 * 1024 && issue === null,
    `${names.length} files (${css.length} css, ${js.length} js), ${bytes} bytes${issue === null ? '' : ` — ${issue}`}`);
}

// 2-5. board_file, sorted_by_value, coverage, farm_steps
let rows: Record<string, unknown>[] = [];
{
  const path = join(out, 'board.json');
  const bytes = existsSync(path) ? statSync(path).size : 0;
  let parsed: unknown = null;
  try { parsed = JSON.parse(readFileSync(path, 'utf8')); } catch { parsed = null; }
  const obj = parsed as { rows?: unknown } | null;
  rows = Array.isArray(obj?.rows) ? (obj.rows as Record<string, unknown>[]) : [];
  let issue: string | null = null;
  if (rows.length < 100 || rows.length > 4000) issue = `${rows.length} rows`;
  else if (bytes > 8 * 1024 * 1024) issue = `${bytes} bytes`;
  else {
    for (const r of rows) {
      if (typeof r.slug !== 'string' || !slugSet.has(r.slug)) { issue = `slug ${String(r.slug)} is not a snapshot protocol`; break; }
      if (typeof r.name !== 'string' || r.name.trim() === '') { issue = `slug ${String(r.slug)} has no name`; break; }
      if (typeof r.rank !== 'number' || !Number.isSafeInteger(r.rank) || r.rank <= 0) { issue = `slug ${String(r.slug)} has rank ${String(r.rank)}`; break; }
      if (typeof r.implied_value_usd !== 'number' || !Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) {
        issue = `slug ${String(r.slug)} has implied value ${String(r.implied_value_usd)}`; break;
      }
      if (!Array.isArray(r.farm_steps)) { issue = `slug ${String(r.slug)} has no farm_steps array`; break; }
    }
  }
  check('board_file', issue === null, `${rows.length} rows, ${bytes} bytes${issue === null ? '' : ` — ${issue}`}`);

  const ranks = rows.map((r) => r.rank as number).sort((a, b) => a - b);
  let order: string | null = null;
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) { order = `rank ${i + 1} is ${ranks[i]}`; break; }
  if (order === null) {
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i]!.implied_value_usd as number) > (rows[i - 1]!.implied_value_usd as number)) { order = `row ${i + 1} outranks row ${i}`; break; }
    }
  }
  if (order === null && rows.length >= 2 && rows[0]!.implied_value_usd === rows[rows.length - 1]!.implied_value_usd) {
    order = `all ${rows.length} rows share $${String(rows[0]!.implied_value_usd)}`;
  }
  check('sorted_by_value', order === null, `ranks 1..${rows.length}, non-increasing implied values${order === null ? '' : ` — ${order}`}`);

  const present = new Set(rows.map((r) => r.slug as string));
  const missing = snapshot.watchlist.filter((s) => !present.has(s));
  check('coverage', missing.length === 0, `${snapshot.watchlist.length - missing.length}/${snapshot.watchlist.length} watchlist slugs present${missing.length === 0 ? '' : ` — missing ${missing.join(', ')}`}`);

  let steps: string | null = null;
  for (const r of rows) {
    const fs = r.farm_steps as unknown[];
    if (fs.length < 3 || fs.length > 12) { steps = `${String(r.slug)}: ${fs.length} steps`; break; }
    for (const s of fs) {
      if (typeof s !== 'string') { steps = `${String(r.slug)}: a step is not a string`; break; }
      if (s.length < 20 || s.length > 600) { steps = `${String(r.slug)}: a step of ${s.length} characters`; break; }
    }
    if (steps !== null) break;
  }
  check('farm_steps', steps === null, `every row carries 3–12 steps of 20–600 characters${steps === null ? '' : ` — ${steps}`}`);
}

// 6. screenshots
{
  const dir = join(out, 'screenshots');
  const names = existsSync(dir) ? readdirSync(dir).filter((n) => !n.startsWith('.')).sort() : [];
  let issue: string | null = null;
  if (names.length < 3 || names.length > 4) issue = `${names.length} images`;
  else {
    for (const n of names) {
      const buf = readFileSync(join(dir, n));
      if (buf.length > 524_288) { issue = `${n}: ${buf.length} bytes`; break; }
      const size = imageSize(buf);
      if (size === null) { issue = `${n}: not a whole PNG or JPEG`; break; }
      const long = Math.max(size.w, size.h);
      const short = Math.min(size.w, size.h);
      if (long > 1440 || short < 800) { issue = `${n}: ${size.w}x${size.h}`; break; }
    }
  }
  const sizes = names.map((n) => `${n} ${statSync(join(dir, n)).size}B`).join(', ');
  check('screenshots', issue === null, `${names.length} images — ${sizes}${issue === null ? '' : ` — ${issue}`}`);
}

// 7. dossier_matches
{
  const path = join(out, 'dossier.json');
  const bytes = existsSync(path) ? statSync(path).size : 0;
  let issue: string | null = null;
  if (!existsSync(path)) issue = 'no dossier.json';
  else if (bytes > 1_572_864) issue = `${bytes} bytes`;
  else {
    let rebuilt: Uint8Array;
    try {
      rebuilt = buildDossier(out, { text_max_bytes: 65_536, screenshots: { max: 4, max_bytes: 524_288 }, dashboard: { max_files: 400, max_bytes: 4_194_304 } });
    } catch (e) {
      issue = `buildDossier refuses: ${e instanceof Error ? e.message : String(e)}`;
      rebuilt = new Uint8Array(0);
    }
    if (issue === null) {
      const mine = readFileSync(path);
      if (mine.length !== rebuilt.length || !mine.equals(Buffer.from(rebuilt))) issue = `dossier.json differs from what buildDossier writes (${mine.length} vs ${rebuilt.length} bytes)`;
    }
  }
  check('dossier_matches', issue === null, `${bytes} bytes${issue === null ? '' : ` — ${issue}`}`);
}

const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? `ALL 7 GATE CHECKS PASS` : `${failed} GATE CHECK${failed === 1 ? '' : 'S'} FAIL`);
process.exit(failed === 0 ? 0 : 1);
