# 3-minute demo video — script

Target: convince judges in 180 seconds that an AI agent loaded with this skill produces correct, working FHEVM code from a one-shot natural-language prompt.

## Setup (off-camera, before recording)

1. Fresh Claude Code session in an empty directory.
2. Run: `node ~/Documents/GitHub/zama-cookbook/skill/scripts/install.mjs claude`
3. Sepolia wallet funded (~0.05 ETH).
4. `frontend/.env` populated with the Sepolia auction address you'll deploy on camera.

## Beats — 180s total

### 0:00–0:15 — Hook (15s)
Voiceover, terminal in shot.
> "Most AI coding agents have no idea how to write FHEVM contracts. Today I'm going to show you the same prompt — once with no help, once with the zama-cookbook skill loaded — and run both through a 28-check eval harness."

Cut to terminal: `cat evals/results/baseline.json | head` → ugly numbers.

### 0:15–0:45 — The split-test result (30s)
Run `pnpm eval:report`. Show the table:
```
TOTAL                 baseline 5/28 (18%)    skill 28/28 (100%)
```
> "18% vs 100%. That's the difference one well-structured skill file makes."

### 0:45–2:15 — Live build (90s)
Open Claude Code. Single prompt:
> "Build me a sealed-bid auction contract on Zama FHEVM where bids stay encrypted and only the winning bid is revealed. Then deploy to Sepolia and show me a frontend where I can place a bid."

Speed up the agent's tool calls. Highlight, in this order:
1. Agent reads `SKILL.md`, then loads `references/anti-patterns.md` + `references/recipes.md`. Show the file accesses.
2. Agent writes the contract — pause on the `FHE.select` instead of `if`, `FHE.allowThis` after every assignment.
3. Agent runs `node skill/scripts/fhe-lint.mjs` — clean.
4. Agent deploys to Sepolia. Show etherscan tab opening with verified contract.
5. Agent boots the Next.js frontend, opens localhost:3000.

### 2:15–2:50 — Use the dApp (35s)
Connect wallet. Type bid `250`. Click "Submit sealed bid".
- Browser shows "Encrypting bid..." log line.
- Tx hash appears.
- Etherscan: ciphertext input, no plaintext bid visible.
> "On-chain, the bid is opaque ciphertext. Nobody — not the seller, not other bidders, not the chain itself — can see the amount until settlement."

Fast-forward (or pre-recorded skip). Click settle. Decryption oracle fires. Winner + winning bid appear.

### 2:50–3:00 — Close (10s)
Cut to repo readme on GitHub.
> "zama-cookbook on GitHub — SKILL.md plus 10 references, three vetted templates, a 13-rule linter, an eval harness, Hardhat and Foundry parity, Next.js frontend. MIT-licensed. Drop it into Claude, Cursor, or Windsurf with one command."

End card: GitHub URL + bounty submission tag.

## Recording tips

- 1920×1080, 30 fps minimum.
- Use OBS or Loom. Avoid Quicktime — its audio drift on long takes is real.
- Record in segments and stitch — easier to retake.
- Pre-warm the Sepolia connection; relayer init can be 3-4s on first call.
- Keep the terminal font ≥ 18pt. Judges may watch on phone.
- One voiceover pass after capture; don't try to narrate live.
