# Agent eval harness

Measures whether an AI coding agent produces **correct** FHEVM contracts when given a natural-language prompt — with vs. without the `fhe-cookbook` skill loaded.

## How it works

Each eval is a `.json` file describing:

```json
{
  "id": "auction-basic",
  "prompt": "Build a sealed-bid auction in Solidity using FHEVM where bids are encrypted and only the highest bid is revealed at settlement.",
  "checks": [
    { "type": "lint-clean" },
    { "type": "uses-pattern", "pattern": "FHE.select" },
    { "type": "uses-pattern", "pattern": "FHE.allowThis" },
    { "type": "no-pattern", "pattern": "if \\(.*FHE\\." },
    { "type": "imports", "value": "@fhevm/solidity/lib/FHE.sol" },
    { "type": "inherits", "value": "ZamaEthereumConfig" }
  ]
}
```

The harness:

1. Iterates over `prompts/*.json`.
2. For each, hands the prompt to your agent (a CLI you wire up — e.g. `claude -p`, `cursor-agent`, or a stub that just reads a saved file).
3. Captures the produced `.sol` file.
4. Runs the checks against it.
5. Tallies pass/fail per (prompt, agent-mode) pair.

## Run

```bash
node evals/run.mjs --agent baseline
node evals/run.mjs --agent skill
node evals/run.mjs --report
```

Output:

```
auction-basic        baseline: 2/6 ✗   skill: 6/6 ✓
erc20-confidential   baseline: 3/7 ✗   skill: 7/7 ✓
private-vote         baseline: 2/6 ✗   skill: 6/6 ✓
─────────────────────────────────────────────────────
                     baseline: 7/19 (37%)
                     skill:    19/19 (100%)
```

## Why it matters for the bounty

The judging brief weighs **agent effectiveness** as a top criterion. A markdown skill without measurement is hand-wave; a harness with numbers is evidence.
