# Encrypted types

FHEVM exposes encrypted analogues of Solidity primitives. Each is a 32-byte handle pointing to a ciphertext stored by the coprocessor.

| Type | Bits | Domain | Use for |
|---|---|---|---|
| `ebool` | 1 | true/false | Comparison results, flags |
| `euint8` | 8 | 0..255 | Small enums, scores |
| `euint16` | 16 | 0..65k | Ages, counters |
| `euint32` | 32 | 0..4.2B | Timestamps, IDs |
| `euint64` | 64 | 0..1.8e19 | **Default for token amounts** |
| `euint128` | 128 | 0..3.4e38 | Large balances, accumulators |
| `euint256` | 256 | full uint256 | Rare — use only when needed |
| `eaddress` | 160 | EVM address | Confidential recipients, owners |

External (calldata-only) variants: `externalEbool`, `externalEuint8..256`, `externalEaddress`. These come from `FHE.fromExternal(...)` at the boundary; **never store them**.

## Picking a width

Gas cost scales with bit width. The price gap between `euint64` and `euint256` for a single `add` is meaningful (often 5–10×).

- **Token balances (6 decimals):** `euint64` covers up to ~1.8 × 10¹³ tokens. Almost always enough.
- **Vote tallies:** `euint32` for tallies up to ~4B voters.
- **Bids in an auction:** match the underlying token's width — usually `euint64`.
- **Bool flags:** `ebool`. Don't pack into `euint8`.

If you cannot prove the value fits, go one size up. Don't reach for `euint256` reflexively.

## Casting

```solidity
euint32 small = FHE.asEuint32(largerHandle); // truncates
euint64 big = FHE.asEuint64(smallerHandle);  // zero-extends
ebool flag = FHE.asEbool(euintHandle);       // non-zero → true
```

Casts produce new handles. ACL grants don't transfer — call `allowThis` / `allow` on the new handle.

## Initialisation

A `euint*` field that has never been written to is "uninitialised". Reading it as input to `FHE.add` etc. typically works (treats as 0), but it is **not decryptable** until written. Best practice: initialise on first user interaction, then `allowThis`.

```solidity
function _ensure(address u) internal {
    if (!FHE.isInitialized(_balance[u])) {
        _balance[u] = FHE.asEuint64(0);
        FHE.allowThis(_balance[u]);
    }
}
```

## What FHEVM does NOT have

- **No `eint*` (signed).** Model as offset-encoded `euint*` if you need signed semantics.
- **No `estring` / `ebytes`.** (Older versions had `ebytesN`; treat as gone in `@fhevm/solidity@0.11.x`. If your task needs encrypted strings, encode as a fixed-width `euint*` ID and resolve off-chain.)
- **No encrypted floating point.** Use fixed-point: store amounts × 10ⁿ.
