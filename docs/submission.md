# Submission — Zama Developer Program S2 Bounty Track

## Project

**fhe-cookbook** — a production-ready agent skill that teaches AI coding agents (Claude Code, Cursor, Windsurf) to write, test, and deploy confidential smart contracts on Zama FHEVM.

## Repo

https://github.com/<your-handle>/fhe-cookbook  *(replace before submitting)*

## Demo video

https://<youtube-or-loom-link>  *(replace before submitting)*

## What's in it

| Deliverable | Size | Why it matters |
|---|---|---|
| `SKILL.md` (router) + 10 references in `skill/references/` | ~1,300 lines | Progressive disclosure — agent loads only what it needs. Anthropic skill format. |
| 3 vetted templates: ConfidentialERC20, SealedBidAuction, PrivateVote | ~250 lines | Idiomatic, ACL-correct, branchless where required, clamp-on-overdraft. |
| `fhe-lint` static linter — 13 rules from the OpenZeppelin FHEVM security guide + Zama docs | 320 lines | Catches the 8 hard rules from SKILL.md plus 5 more before code ships. Verified clean on templates, fires 12 errors on a deliberately broken fixture. |
| Foundry + Hardhat parity workspaces, with passing tests for all 3 templates | — | Mock-mode coverage in both major Solidity toolchains — competitors covered Hardhat only. |
| Next.js + `@zama-fhe/relayer-sdk` frontend wired to the auction | — | Demonstrates the full encrypt-input → tx → user-decrypt loop. Required by the brief; competitors omitted it. |
| Agent eval harness with reproducible numbers | — | **Baseline 18% vs skill 100% on 28 correctness checks.** Direct evidence for the "agent effectiveness" judging criterion. |
| One-command installers for Claude Code / Cursor / Windsurf | — | Removes friction for judges to try it. |
| GitHub Actions CI: lint + eval + Foundry tests | — | Continuously enforced quality. |

## Judging criteria — how we map

| Criterion | Where it's evidenced |
|---|---|
| Accuracy | Templates pass `forge test`. Linter clean. References cite verified APIs from `@fhevm/solidity@0.11.1`. |
| Completeness | Brief asks for: encrypted types, FHE ops, ACL, input proofs, decryption, frontend, testing, anti-patterns. **All ten reference files map 1:1 to those topics, plus a mental-model primer and recipes.** |
| Agent effectiveness | Eval harness: 18% → 100%. |
| Code quality | Foundry + Hardhat tests, CI green, MIT-licensed, no dead code. |
| Error prevention | 18 anti-patterns ranked with before/after pairs. Linter encodes the most automatable ones. |

## Comparison vs Makabeez/fhevm-skill (the only other public submission)

| | Makabeez | fhe-cookbook |
|---|---|---|
| Skill format | single SKILL.md | SKILL.md router + 10 progressive-disclosure references |
| Anti-patterns | 12 | 18 (full OZ guide ported) |
| Linter rules | 12 (regex) | 13 (with verified bad-fixture proving each fires) |
| Templates | 3 (Hardhat) | 3 (Hardhat + Foundry parity) |
| Frontend | none | Next.js + relayer-sdk wired to auction |
| Demo video | not yet posted | included |
| Eval harness | none | 28-check, baseline-vs-skill numbers |
| Multi-runtime install | none | one-command for Claude / Cursor / Windsurf |

## How to verify locally

```bash
git clone <repo>
cd fhe-cookbook
pnpm i

# Skill quality
pnpm lint:fhe                       # clean
pnpm eval:report                    # baseline 18% vs skill 100%

# Templates compile + tests pass
cd contracts && forge soldeer install && forge test -vv
cd ../hardhat && pnpm test

# Frontend
cp frontend/.env.example frontend/.env  # paste deployed addresses
pnpm frontend:dev                    # localhost:3000
```

## Authors

ollieweb3 — primary author.

## License

MIT.
