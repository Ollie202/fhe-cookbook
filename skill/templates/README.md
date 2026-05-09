# Templates

Ten vetted reference contracts. Five are deployed live on Sepolia (see the [main README](../../README.md#live-on-sepolia)); the other five ship as additional reference patterns the agent can adapt.

## Deployed (live on Sepolia)

| Folder | Showcases |
|---|---|
| [`confidential-erc20/`](confidential-erc20/) | `euint64` balances, silent-clamp transfers |
| [`sealed-bid-auction/`](sealed-bid-auction/) | Branchless `FHE.select` + post-deadline public reveal |
| [`private-vote/`](private-vote/) | Fixed-width loop tally, multi-handle reveal |
| [`blind-lottery/`](blind-lottery/) | `FHE.randEuint*` + branchless array selection |
| [`confidential-allowlist/`](confidential-allowlist/) | `ebool` membership + silent-no-op gating |

## Reference patterns (not deployed)

These exist as ready-to-adapt code the agent can pull from. Each is linter-clean and uses the same v0.11 API as the deployed five.

| Folder | Showcases |
|---|---|
| [`confidential-payroll/`](confidential-payroll/) | Batched `FHE.fromExternal` with one shared input proof |
| [`private-rps/`](private-rps/) | Encrypted-only resolution; result publicly decryptable |
| [`encrypted-dice/`](encrypted-dice/) | `FHE.randEuint8` + plaintext `FHE.rem` for fair 1..6 rolls |
| [`confidential-vesting/`](confidential-vesting/) | Plaintext-divisor scaling on encrypted totals over time |
| [`private-limit-order/`](private-limit-order/) | Conditional public reveal — only matched price is exposed |

## Verification

```bash
node skill/scripts/fhe-lint.mjs skill/templates    # all 10 lint clean
cd hardhat && pnpm test                            # 12 passing tests on the deployed 5
```

When adapting any template, replace the constructor args, names, and business-logic stubs. The ACL pattern, branchless updates, and decryption flow are not negotiable — keep them.
