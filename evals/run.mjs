#!/usr/bin/env node
/**
 * eval runner — scores agent output against per-prompt checks.
 *
 * Usage:
 *   node evals/run.mjs --agent baseline       # scores fixtures/<id>.baseline.sol
 *   node evals/run.mjs --agent skill          # scores fixtures/<id>.skill.sol
 *   node evals/run.mjs --report               # prints comparison table
 *
 * Wire your agent to write its output to fixtures/<id>.<agent>.sol before running.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROMPTS = join(__dirname, 'prompts');
const FIXTURES = join(__dirname, 'fixtures');
const RESULTS = join(__dirname, 'results');
mkdirSync(FIXTURES, { recursive: true });
mkdirSync(RESULTS, { recursive: true });

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? true : def;
}

function check(src, c, file) {
  switch (c.type) {
    case 'imports':
      return { pass: src.includes(c.value), label: `imports ${c.value}` };
    case 'inherits':
      return { pass: new RegExp(`is\\s+[^{]*\\b${c.value}\\b`).test(src), label: `inherits ${c.value}` };
    case 'uses-pattern':
      return { pass: new RegExp(c.pattern).test(src), label: `uses ${c.pattern}` };
    case 'no-pattern':
      return { pass: !new RegExp(c.pattern).test(src), label: `does not use ${c.pattern}` };
    case 'lint-clean': {
      const r = spawnSync('node', [join(ROOT, 'skill/scripts/fhe-lint.mjs'), file], { encoding: 'utf8' });
      // exit 0 = clean (errors=0), exit 1 = errors present
      return { pass: r.status === 0, label: `linter clean` };
    }
    default:
      return { pass: false, label: `unknown check ${c.type}` };
  }
}

function score(promptFile, agent) {
  const prompt = JSON.parse(readFileSync(promptFile, 'utf8'));
  const fixture = join(FIXTURES, `${prompt.id}.${agent}.sol`);
  if (!existsSync(fixture)) return { id: prompt.id, agent, missing: true, total: prompt.checks.length, passed: 0, results: [] };
  const src = readFileSync(fixture, 'utf8');
  const results = prompt.checks.map((c) => ({ ...c, ...check(src, c, fixture) }));
  return { id: prompt.id, agent, total: results.length, passed: results.filter((r) => r.pass).length, results };
}

function runAgent(agent) {
  const out = [];
  for (const f of readdirSync(PROMPTS).filter((x) => x.endsWith('.json'))) {
    const r = score(join(PROMPTS, f), agent);
    out.push(r);
    const fillBar = '█'.repeat(r.passed) + '░'.repeat(r.total - r.passed);
    if (r.missing) {
      console.log(`${r.id.padEnd(22)} ${agent.padEnd(10)}  no fixture (expected fixtures/${r.id}.${agent}.sol)`);
    } else {
      console.log(`${r.id.padEnd(22)} ${agent.padEnd(10)}  ${r.passed}/${r.total}  ${fillBar}`);
    }
  }
  writeFileSync(join(RESULTS, `${agent}.json`), JSON.stringify(out, null, 2));
  return out;
}

function report() {
  const baseline = JSON.parse(readFileSync(join(RESULTS, 'baseline.json'), 'utf8'));
  const skill = JSON.parse(readFileSync(join(RESULTS, 'skill.json'), 'utf8'));
  let bP = 0, bT = 0, sP = 0, sT = 0;
  console.log('\n# eval comparison\n');
  console.log('id'.padEnd(22) + 'baseline'.padEnd(14) + 'skill'.padEnd(14));
  console.log('-'.repeat(50));
  for (const b of baseline) {
    const s = skill.find((x) => x.id === b.id);
    bP += b.passed; bT += b.total; sP += s.passed; sT += s.total;
    const bMark = b.passed === b.total ? '✓' : '✗';
    const sMark = s.passed === s.total ? '✓' : '✗';
    console.log(b.id.padEnd(22) + `${b.passed}/${b.total} ${bMark}`.padEnd(14) + `${s.passed}/${s.total} ${sMark}`.padEnd(14));
  }
  console.log('-'.repeat(50));
  console.log('TOTAL'.padEnd(22) + `${bP}/${bT} (${Math.round(bP/bT*100)}%)`.padEnd(14) + `${sP}/${sT} (${Math.round(sP/sT*100)}%)`.padEnd(14));
}

const agent = arg('--agent');
if (agent && typeof agent === 'string') runAgent(agent);
else if (process.argv.includes('--report')) report();
else {
  console.log('usage: node evals/run.mjs --agent baseline|skill | --report');
  process.exit(2);
}
