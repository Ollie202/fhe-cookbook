#!/usr/bin/env node
/**
 * fhe-lint — static linter for FHEVM Solidity contracts.
 *
 * Encodes the anti-patterns from skill/references/anti-patterns.md.
 * Heuristic / regex-based; not a full Solidity parser. Designed to catch
 * the common 20% of footguns that produce 80% of bugs.
 *
 * Usage:
 *   node fhe-lint.mjs <file-or-dir> [<file-or-dir>...]
 *
 * Exit code: 0 = clean, 1 = issues found.
 */

import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const RULES = [
  {
    id: 'AP-001',
    name: 'branch-on-ebool',
    severity: 'error',
    test: (src) => {
      const issues = [];
      // if (something with FHE comparison or ebool var)
      const lines = src.split('\n');
      const eboolVars = new Set();
      const ebVarRe = /\bebool\s+([A-Za-z_]\w*)/g;
      let m;
      while ((m = ebVarRe.exec(src))) eboolVars.add(m[1]);

      lines.forEach((line, i) => {
        const ifMatch = line.match(/^\s*(?:if|require|assert)\s*\(([^)]+)\)/);
        if (!ifMatch) return;
        const cond = ifMatch[1];
        if (/FHE\.(gt|lt|ge|le|eq|ne)\s*\(/.test(cond)) {
          issues.push({ line: i + 1, msg: 'branching/require on FHE comparison result (ebool). Use FHE.select.' });
        } else {
          for (const v of eboolVars) {
            if (new RegExp(`\\b${v}\\b`).test(cond) && !/isSenderAllowed|isAllowed|isInitialized|isPubliclyDecryptable/.test(cond)) {
              issues.push({ line: i + 1, msg: `branching on ebool variable '${v}'. Use FHE.select.` });
              break;
            }
          }
        }
      });
      return issues;
    },
  },
  {
    id: 'AP-002',
    name: 'missing-allow-this',
    severity: 'error',
    test: (src) => {
      // Look for assignments to state mappings/fields of FHE-typed values without a following allowThis on the same handle.
      // Heuristic: any line with `_xxx[...] = FHE....` or `_xxx = FHE....` should be followed (within 5 lines) by FHE.allowThis(<that target>).
      const issues = [];
      const lines = src.split('\n');
      const assignRe = /^\s*(_?\w+(?:\[[^\]]+\])?)\s*=\s*FHE\./;
      lines.forEach((line, i) => {
        const m = line.match(assignRe);
        if (!m) return;
        const target = m[1];
        const window = lines.slice(i, Math.min(i + 12, lines.length)).join('\n');
        const escTarget = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!new RegExp(`FHE\\.allowThis\\s*\\(\\s*${escTarget}\\s*\\)`).test(window)) {
          issues.push({ line: i + 1, msg: `assignment to '${target}' from FHE op without nearby FHE.allowThis(${target}).` });
        }
      });
      return issues;
    },
  },
  {
    id: 'AP-004',
    name: 'encrypted-divisor',
    severity: 'error',
    test: (src) => {
      const issues = [];
      const lines = src.split('\n');
      // Balanced-parens-aware: matches FHE.div/rem(<arg1>, <arg2>) where arg2 may contain one nesting level
      const re = /FHE\.(div|rem)\s*\(\s*([^,]+?),\s*([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
      lines.forEach((line, i) => {
        let m;
        while ((m = re.exec(line))) {
          const arg2 = m[3].trim();
          // Plaintext-looking: literal number or type-cast like uint64(anything).
          if (!/^(\d+|uint(?:8|16|32|64|128|256)\s*\(.+\))$/.test(arg2)) {
            issues.push({ line: i + 1, msg: `FHE.${m[1]} divisor '${arg2}' must be plaintext (literal or uintN cast).` });
          }
        }
      });
      return issues;
    },
  },
  {
    id: 'AP-005',
    name: 'external-euint-in-state',
    severity: 'error',
    test: (src) => {
      const issues = [];
      const re = /^\s*mapping\s*\([^)]*=>\s*external(Euint\w+|Ebool|Eaddress)\s*\)|^\s*external(Euint\w+|Ebool|Eaddress)\s+(?:public|private|internal)?\s*[A-Za-z_]\w*\s*;/gm;
      let m;
      while ((m = re.exec(src))) {
        const line = src.slice(0, m.index).split('\n').length;
        issues.push({ line, msg: 'externalEuint*/externalEbool/externalEaddress is calldata-only — never store in state. Convert via FHE.fromExternal first.' });
      }
      return issues;
    },
  },
  {
    id: 'AP-006',
    name: 'requestDecryption-removed',
    severity: 'error',
    test: (src) => {
      const issues = [];
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (/\bFHE\.requestDecryption\s*\(/.test(line)) {
          issues.push({ line: i + 1, msg: 'FHE.requestDecryption was removed in @fhevm/solidity@0.11. Use FHE.makePubliclyDecryptable (everyone) or FHE.allow + SDK userDecrypt (one user).' });
        }
        if (/\bFHE\.checkSignatures\s*\(/.test(line)) {
          issues.push({ line: i + 1, msg: 'FHE.checkSignatures (oracle callback verifier) was part of the removed async-decrypt API in v0.11.' });
        }
      });
      return issues;
    },
  },
  {
    id: 'AP-007',
    name: 'public-reveal-on-user-state',
    severity: 'info',
    test: (src) => {
      // Flag makePubliclyDecryptable on something that looks like a per-user state
      // (e.g. _balance[user], a mapping(address => ...) entry). Heuristic.
      const issues = [];
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        const m = line.match(/FHE\.makePubliclyDecryptable\s*\(\s*([^)]+)\)/);
        if (!m) return;
        const arg = m[1];
        if (/\[\s*(msg\.sender|\w+)\s*\]/.test(arg)) {
          issues.push({ line: i + 1, msg: `makePubliclyDecryptable on per-user state '${arg.trim()}' — public reveal is one-way and irreversible. Confirm this is intended.` });
        }
      });
      return issues;
    },
  },
  {
    id: 'AP-013',
    name: 'forwarded-input-proof',
    severity: 'warning',
    test: (src) => {
      // Heuristic: a function takes (externalEuintX a, bytes inputProof) and passes both to an external call.
      const issues = [];
      const fnRe = /function\s+\w+\s*\(([^)]*external(?:Euint\w+|Ebool|Eaddress)[^)]*?bytes\s+\w+\s+inputProof[^)]*)\)[^{]*\{([\s\S]*?)\n\s*\}/g;
      let m;
      while ((m = fnRe.exec(src))) {
        const body = m[2];
        if (/\.\w+\s*\([^)]*inputProof[^)]*\)/.test(body) && !/FHE\.fromExternal/.test(body)) {
          const line = src.slice(0, m.index).split('\n').length;
          issues.push({ line, msg: 'inputProof appears forwarded to another contract without ingestion via FHE.fromExternal. Proofs are caller+target bound — re-encrypt for the actual target.' });
        }
      }
      return issues;
    },
  },
  {
    id: 'AP-014',
    name: 'delegatecall-with-fhe',
    severity: 'warning',
    test: (src) => {
      const issues = [];
      if (!/\bFHE\.|@fhevm\/solidity/.test(src)) return issues;
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (/\.delegatecall\s*\(/.test(line)) {
          issues.push({ line: i + 1, msg: 'delegatecall in an FHE-touching contract — callee inherits ACL. Audit target as your own code.' });
        }
      });
      return issues;
    },
  },
  {
    id: 'AP-015',
    name: 'oversized-euint',
    severity: 'info',
    test: (src) => {
      const issues = [];
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (/\beuint256\b/.test(line) && !/\/\/.*ok|allow.*256/.test(line)) {
          issues.push({ line: i + 1, msg: 'euint256 is expensive. Confirm value range cannot fit a smaller type.' });
        }
      });
      return issues;
    },
  },
  {
    id: 'AP-016',
    name: 'legacy-tfhe',
    severity: 'error',
    test: (src) => {
      const issues = [];
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (/\bTFHE\./.test(line) || /["']fhevm\/lib\/TFHE\.sol["']/.test(line)) {
          issues.push({ line: i + 1, msg: 'TFHE.* is the deprecated pre-0.7 API. Use FHE.* from @fhevm/solidity/lib/FHE.sol.' });
        }
      });
      return issues;
    },
  },
  {
    id: 'STACK-001',
    name: 'wrong-package',
    severity: 'error',
    test: (src) => {
      const issues = [];
      // Bare 'fhevm' package import (not @fhevm/...) is the deprecated package.
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (/import\s+[^;]*["']fhevm\/[^"']+["']/.test(line)) {
          issues.push({ line: i + 1, msg: 'imports from bare "fhevm/" — that package is deprecated. Use "@fhevm/solidity/...".' });
        }
      });
      return issues;
    },
  },
  {
    id: 'STACK-002',
    name: 'missing-config-inheritance',
    severity: 'warning',
    test: (src) => {
      const issues = [];
      if (!/import\s+\{[^}]*FHE[^}]*\}\s+from\s+["']@fhevm\/solidity\/lib\/FHE\.sol/.test(src)) return issues;
      // Find contract declarations
      const re = /contract\s+(\w+)\s*(?:is\s+([^{]+))?\{/g;
      let m;
      while ((m = re.exec(src))) {
        const name = m[1];
        const inherits = (m[2] || '').trim();
        if (!/(ZamaEthereumConfig|SepoliaConfig)/.test(inherits)) {
          const line = src.slice(0, m.index).split('\n').length;
          issues.push({ line, msg: `contract '${name}' uses FHE but does not inherit ZamaEthereumConfig/SepoliaConfig — coprocessor addresses unset.` });
        }
      }
      return issues;
    },
  },
];

function* walk(p) {
  const s = statSync(p);
  if (s.isDirectory()) {
    for (const e of readdirSync(p)) {
      if (e === 'node_modules' || e === 'dependencies' || e === 'out' || e.startsWith('.')) continue;
      yield* walk(join(p, e));
    }
  } else if (extname(p) === '.sol') {
    yield p;
  }
}

function lintFile(file) {
  const src = readFileSync(file, 'utf8');
  if (!/@fhevm\/solidity|\bFHE\.|TFHE/.test(src)) return [];
  const out = [];
  for (const rule of RULES) {
    const found = rule.test(src) || [];
    for (const f of found) out.push({ file, rule, ...f });
  }
  return out;
}

function colour(sev, s) {
  const c = sev === 'error' ? '\x1b[31m' : sev === 'warning' ? '\x1b[33m' : '\x1b[36m';
  return `${c}${s}\x1b[0m`;
}

function main() {
  const targets = process.argv.slice(2);
  if (!targets.length) {
    console.error('usage: fhe-lint <file-or-dir> [...]');
    process.exit(2);
  }
  let errors = 0, warnings = 0, infos = 0;
  for (const t of targets) {
    for (const f of walk(t)) {
      const issues = lintFile(f);
      for (const it of issues) {
        const rel = relative(process.cwd(), it.file);
        console.log(`${rel}:${it.line}  ${colour(it.rule.severity, it.rule.severity)}  [${it.rule.id} ${it.rule.name}]  ${it.msg}`);
        if (it.rule.severity === 'error') errors++;
        else if (it.rule.severity === 'warning') warnings++;
        else infos++;
      }
    }
  }
  const total = errors + warnings + infos;
  console.log(`\nfhe-lint: ${errors} error(s), ${warnings} warning(s), ${infos} info(s)`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
