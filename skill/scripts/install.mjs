#!/usr/bin/env node
/**
 * Install the fhe-cookbook skill into a target agent's skill directory.
 *
 *   node skill/scripts/install.mjs claude   # ~/.claude/skills/fhe-cookbook
 *   node skill/scripts/install.mjs cursor   # .cursor/rules/fhe-cookbook.md
 *   node skill/scripts/install.mjs windsurf # .windsurf/rules/fhe-cookbook.md
 */
import { cpSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(__dirname, '..');
const target = process.argv[2];

if (!target) {
  console.error('usage: install.mjs <claude|cursor|windsurf>');
  process.exit(2);
}

if (target === 'claude') {
  const dest = join(homedir(), '.claude', 'skills', 'fhe-cookbook');
  mkdirSync(dest, { recursive: true });
  cpSync(SKILL_DIR, dest, { recursive: true });
  console.log(`installed → ${dest}`);
} else if (target === 'cursor' || target === 'windsurf') {
  const folder = target === 'cursor' ? '.cursor/rules' : '.windsurf/rules';
  mkdirSync(folder, { recursive: true });
  // Inline references into a single file for editors that don't support directory skills
  const skillMd = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8');
  const ap = readFileSync(join(SKILL_DIR, 'references', 'anti-patterns.md'), 'utf8');
  const recipes = readFileSync(join(SKILL_DIR, 'references', 'recipes.md'), 'utf8');
  const merged = `${skillMd}\n\n---\n\n# Anti-patterns (full list)\n\n${ap}\n\n---\n\n# Recipes\n\n${recipes}\n`;
  writeFileSync(join(folder, 'fhe-cookbook.md'), merged);
  console.log(`installed → ${folder}/fhe-cookbook.md`);
} else {
  console.error(`unknown target: ${target}`);
  process.exit(2);
}
