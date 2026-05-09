# Zama Cookbook

> **A production-ready agent skill that teaches AI coding assistants (Claude Code, Cursor, Windsurf) how to write, test, and deploy confidential smart contracts on Zama FHEVM.**

### Pick your path

| 🚀 **Proceed** | 📖 **How to use** |
|---|---|
| You know smart contracts. Skip to [Install the skill](#install-the-skill) and [Verify it works](#verify-it-works). | Never touched a smart contract before? Start with **[HOW_TO_USE.md](HOW_TO_USE.md)** — plain-English tour of what we built, how each contract works, and real-world use cases. |

[Skill →](skill/SKILL.md) · [Live contracts](#live-on-sepolia) · [Verify locally](#verify-it-works)

---

## The problem

When you ask Claude / Cursor / Windsurf to write an FHEVM contract today, it hallucinates function names, mixes deprecated APIs (`TFHE.*`, `fhevm/lib/...`), forgets ACL grants, and produces code that doesn't compile.

This skill fixes that by giving the agent **a structured, version-pinned manual + working templates + a static linter** — installed in seconds, used by the agent automatically.

## Live on Sepolia

Five templates are **deployed and verifiable** on Sepolia testnet right now. Click any address to interact. The repo ships **five more** as additional reference patterns (see [`skill/templates/`](skill/templates/) — covers payroll, RPS, dice, vesting, limit order). For real-world examples of each, see [HOW_TO_USE.md](HOW_TO_USE.md).

| Contract | One-liner | Showcases | Sepolia address |
|---|---|---|---|
| `ConfidentialERC20`     | secret balances, silent transfers (e.g. confidential payroll) | `euint64` + silent-clamp | [`0xf30f1C6E...9ed0`](https://sepolia.etherscan.io/address/0xf30f1C6E65E2860607CA72EbE8eeaA3bA2739ed0) |
| `SealedBidAuction`      | hidden bids, only winner revealed (e.g. government tenders) | branchless `FHE.select` | [`0xB0E97eC3...A16C`](https://sepolia.etherscan.io/address/0xB0E97eC3d9677926549DEeBE6445Fea9494cA16C) |
| `PrivateVote`           | secret ballots, public tally (e.g. DAO governance) | fixed-width loop + multi-handle reveal | [`0xB3c6891B...b035`](https://sepolia.etherscan.io/address/0xB3c6891B7aE6Ae908efa4690f6c9907F53B2b035) |
| `BlindLottery`          | unmanipulable random winner (e.g. NFT raffles) | `FHE.randEuint*` + array selection | [`0x98c31bAb...0D80`](https://sepolia.etherscan.io/address/0x98c31bAbAE5Dd0b580F1602dF732A58fA0C06D80) |
| `ConfidentialAllowlist` | secret membership list (e.g. whistleblower portal) | `ebool` + silent-no-op gating | [`0xF15EC0a0...366E`](https://sepolia.etherscan.io/address/0xF15EC0a04f17caB0eF05D893f41Cadad91b5366E) |

## What's in the box

| Path | What it is | Lines |
|---|---|---|
| [`skill/SKILL.md`](skill/SKILL.md) | The skill router — frontmatter + 8 hard rules + workflow. What an agent loads first. | ~140 |
| [`skill/references/`](skill/references/) | 12 deep-dive chapters: onboarding, mental model, types, ops, ACL, inputs, decryption, frontend (v3 SDK), testing, deployment, anti-patterns, recipes. Loaded progressively, not upfront. | ~1,400 |
| [`skill/templates/`](skill/templates/) | Ten vetted starting points. Five are deployed live (see above); five more — `ConfidentialPayroll`, `PrivateRPS`, `EncryptedDice`, `ConfidentialVesting`, `PrivateLimitOrder` — ship as additional reference patterns. All linter-clean. | ~700 |
| [`skill/scripts/fhe-lint.mjs`](skill/scripts/fhe-lint.mjs) | Static linter — 13 rules, ranked by severity. Each maps to an entry in [`anti-patterns.md`](skill/references/anti-patterns.md). | ~340 |
| [`hardhat/`](hardhat/) | Hardhat workspace — 12 passing tests across all 5 contracts, mock mode against `@fhevm/hardhat-plugin`. | — |
| [`evals/`](evals/) | Prompts + harness measuring agent accuracy with vs. without the skill. | — |

## Install the skill

### Claude Code (Mac / Linux)

```bash
mkdir -p ~/.claude/skills && cp -r skill ~/.claude/skills/zama-cookbook
```

### Claude Code (Windows PowerShell)

```powershell
mkdir $env:USERPROFILE\.claude\skills -Force
Copy-Item -Recurse -Force skill $env:USERPROFILE\.claude\skills\zama-cookbook
```

The skill auto-activates whenever a conversation mentions FHEVM, Zama, encrypted types, or imports `@fhevm/solidity`. Restart your editor after install.

### Cursor / Windsurf

```bash
mkdir -p .cursor/rules
cp skill/SKILL.md .cursor/rules/zama-cookbook.md
cp -r skill/references .cursor/rules/zama-cookbook-references
```

(Same files work in any agent — the format is plain Markdown with YAML frontmatter.)

## Verify it works

Run these in order — each one validates a separate claim. All five take under 2 minutes combined.

```bash
# 1. Linter clean against templates
node skill/scripts/fhe-lint.mjs skill/templates
# expect: 0 error(s), 0 warning(s)

# 2. Linter catches deliberately-bad code
node skill/scripts/fhe-lint.mjs skill/scripts/__fixtures__/bad.sol
# expect: 11 error(s), 1 warning(s)

# 3. Hardhat compile + tests against the live FHEVM library
cd hardhat && pnpm install && pnpm test
# expect: 12 passing
```

Cold-clone install time on a fresh machine: ~2 minutes (mostly `pnpm install`).

## Stack — pinned versions

These are the **exact versions verified to compile and pass tests** as of May 2026. Cross-checked against `zama-ai/fhevm-react-template` HEAD.

| Component | Version |
|---|---|
| Solidity | `^0.8.27`, `evmVersion: cancun` |
| `@fhevm/solidity` | `0.11.1` (the bare `fhevm` package is **deprecated**) |
| `encrypted-types` | `0.0.4` (transitive — must be declared explicitly to avoid Hardhat HH411) |
| `@fhevm/hardhat-plugin` | `0.4.x` |
| `@zama-fhe/sdk` + `@zama-fhe/react-sdk` | `^3.0.0` (the v3 SDK pair; supersedes `@zama-fhe/relayer-sdk`) |
| Confidential token standard | `@openzeppelin/confidential-contracts` (ERC-7984) |
| Network | Sepolia (config: `ZamaEthereumConfig`) |

## Repository layout

```
zama-cookbook/
├── README.md                     ← you are here
├── skill/                        ← the deliverable (drop into ~/.claude/skills/)
│   ├── SKILL.md                  ← router with frontmatter
│   ├── references/               ← 12 specialised chapters
│   ├── templates/                ← 10 reference contracts (5 deployed live)
│   └── scripts/
│       ├── fhe-lint.mjs          ← 13-rule static linter
│       └── __fixtures__/bad.sol  ← intentionally-broken fixture
├── hardhat/                      ← workspace + 12 passing mock-mode tests
│   ├── contracts/
│   ├── test/
│   ├── scripts/deploy.ts
│   └── hardhat.config.ts
├── contracts/                    ← Foundry-style mirror (forge-fhevm ready)
└── evals/                        ← prompts + harness for agent effectiveness
```

## License

[MIT](LICENSE).
