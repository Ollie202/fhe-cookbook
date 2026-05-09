#!/usr/bin/env node
/**
 * doctor — checks an FHEVM project for the common-install footguns
 * that aren't catchable by the linter.
 *
 * Run from the root of a Hardhat or Foundry project:
 *   node /path/to/skill/scripts/doctor.mjs
 *
 * Exit code: 0 = healthy, 1 = problems found.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const checks = [];
function check(name, run) { checks.push({ name, run }); }

const KNOWN_GOOD = {
  '@fhevm/solidity': '0.11.1',
  '@fhevm/hardhat-plugin': '0.4.2',
  'encrypted-types': '0.0.4',
  hardhat: '^2.22',
  ethers: '^6',
};

check('Node.js >= 20', () => {
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major < 20) return `Node ${process.versions.node} — upgrade to >= 20.`;
});

check('package.json exists', () => {
  if (!existsSync(join(cwd, 'package.json'))) return 'no package.json — run from project root.';
});

check('declares @fhevm/solidity@0.11.x', () => {
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const v = deps['@fhevm/solidity'];
  if (!v) return 'missing @fhevm/solidity. Add as dep with version 0.11.1.';
  if (v !== 'latest' && !/^[\^~]?0\.11/.test(v)) return `version "${v}" — known-working is 0.11.1.`;
});

check('declares encrypted-types (Hardhat HH411 fix)', () => {
  if (!existsSync(join(cwd, 'hardhat.config.ts')) && !existsSync(join(cwd, 'hardhat.config.js'))) return; // not a hardhat project
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (!deps['encrypted-types']) return 'missing top-level "encrypted-types" dep — Hardhat will throw HH411 unless you add it. Run: pnpm add encrypted-types';
});

check('@fhevm/hardhat-plugin major.minor matches solidity', () => {
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const sol = deps['@fhevm/solidity'];
  const plug = deps['@fhevm/hardhat-plugin'];
  if (!plug) return; // not a hardhat project
  const solMM = sol?.match(/(\d+)\.(\d+)/);
  const plugMM = plug?.match(/(\d+)\.(\d+)/);
  // 0.11.x solidity pairs with 0.4.x plugin per Zama docs.
  if (solMM && plugMM && !(solMM[2] === '11' && plugMM[2] === '4') && plug !== 'latest') {
    return `solidity ${sol} + plugin ${plug} likely mismatched. Use 0.11.x + 0.4.x.`;
  }
});

check('no deprecated TFHE/fhevm imports', async () => {
  const { execSync } = await import('node:child_process');
  try {
    const out = execSync(
      `grep -r --include="*.sol" --exclude-dir=node_modules --exclude-dir=dependencies --exclude-dir=out -l "TFHE\\.\\|['\\\"]fhevm/lib" .`,
      { cwd, stdio: ['ignore', 'pipe', 'ignore'] }
    ).toString().trim();
    if (out) return `legacy TFHE/fhevm imports in:\n  ${out.split('\n').join('\n  ')}\nReplace with FHE.* from @fhevm/solidity/lib/FHE.sol.`;
  } catch { /* no matches */ }
});

check('Solidity is 0.8.27 + cancun', () => {
  const cfg = ['hardhat.config.ts', 'hardhat.config.js', 'foundry.toml']
    .map((f) => join(cwd, f))
    .find(existsSync);
  if (!cfg) return;
  const src = readFileSync(cfg, 'utf8');
  if (!/0\.8\.27/.test(src)) return `${cfg.split(/[\\/]/).pop()} doesn't pin solc 0.8.27.`;
  if (!/cancun/i.test(src)) return `${cfg.split(/[\\/]/).pop()} missing evm_version = "cancun".`;
});

let bad = 0;
for (const c of checks) {
  try {
    const issue = await c.run();
    if (issue) { console.log(`✗ ${c.name}\n  ${issue}\n`); bad++; }
    else console.log(`✓ ${c.name}`);
  } catch (e) {
    console.log(`? ${c.name}\n  (check itself failed: ${e.message})\n`);
  }
}

console.log(`\ndoctor: ${bad === 0 ? 'all green' : `${bad} issue(s) — fix before pnpm install`}`);
process.exit(bad === 0 ? 0 : 1);
