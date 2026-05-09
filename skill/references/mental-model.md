# Mental model

If you have written normal Solidity, FHEVM will fight you in three places. Internalising these saves hours.

## 1. Handles, not values

`euint64 balance` is **not** a `uint64`. It is a 32-byte handle that points to a ciphertext stored by the FHE coprocessor. Your contract can pass it around, persist it, hand it to FHE operations — but it cannot read the underlying number, ever.

The plaintext only exists at two boundaries:

- A user encrypts off-chain and submits `(externalEuintX, inputProof)`. Your contract calls `FHE.fromExternal` to ingest.
- A user (granted via ACL) calls the relayer off-chain to decrypt a handle they're authorized for.

In between: pure handle land.

## 2. No control flow on encrypted data

```solidity
ebool isHigh = FHE.gt(a, b);
if (isHigh) { ... } // ❌ illegal — control flow leaks
```

The EVM literally cannot evaluate `ebool`. And even if it could, branching on it would defeat the whole point. Replace every `if (encryptedCondition)` with `FHE.select(cond, ifTrue, ifFalse)`. Both branches always execute; the selection is encrypted.

This means **algorithms with data-dependent loops or early-exits don't translate**. You either:
- Run a fixed number of iterations regardless of data, or
- Accept publicly visible loop bounds with privately conditional updates.

A linear scan over `n` items with branchless updates is idiomatic. A binary search is not.

## 3. Permissions are explicit and per-handle

The ACL governs who can use which handle. Three rules:

- The contract that produced a handle has access **for the current transaction only**.
- Want access in the next tx? `FHE.allowThis(h)`.
- Want a user to decrypt? `FHE.allow(h, user)`.

A handle without grants is junk: you can't read it next tx, the user can't decrypt it. The single most common bug in FHEVM code is forgetting `allowThis` or `allow`.

## 4. Decryption is off-chain — there is no on-chain `decrypt`

There is no synchronous `decrypt(handle) returns (uint64)` and (since `@fhevm/solidity@0.11`) no on-chain async oracle either. Two off-chain paths instead:

**(a) User-scoped reveal** — for when only one user needs the plaintext (their own balance, their own bid).

```text
contract:  FHE.allow(handle, user)
frontend:  v3 SDK useUserDecrypt({ handles }) → plaintext bigint
```

**(b) Public reveal** — for when a value should be visible to everyone after some condition (auction settled, vote ended).

```text
contract:  FHE.makePubliclyDecryptable(handle)   // one-way, irreversible
frontend:  v3 SDK usePublicDecrypt({ handles }) → plaintext, no permit needed
```

If your contract logic itself needs the cleartext to act on it, you have to redesign — keep the entire computation in encrypted form using `FHE.select`, then reveal the result at the end. Older tutorials show `FHE.requestDecryption(...) → onDecrypted(...)`; that pattern is gone in v0.11.

## 5. Costs are not like normal Solidity

A `FHE.add` is hundreds of times more expensive than an EVM `add`. A `FHE.mul` is more again. Width matters: `euint256.add` ≫ `euint64.add`.

Optimisation rules of thumb:
- Pick the smallest type that fits your value range.
- Prefer `FHE.select` over duplicate computation paths.
- Aggregate before ACL-granting (one `allow` per handle, not per intermediate).
- Hot loops with FHE inside are expensive; keep them tight and small.

## 6. The two boundary actors

It helps to keep the cast straight:

| Actor | Where | Does what |
|---|---|---|
| **User wallet + relayer SDK** | Browser/Node | Encrypts inputs; signs decrypt permits; receives plaintext outputs |
| **Relayer / coprocessor / KMS / gateway** | Zama-operated | Stores ciphertexts, runs FHE ops, signs decryption results |
| **Your contract** | EVM | Holds handles, calls `FHE.*`, manages ACL, requests/receives oracle decryptions |

You write the contract. The user uses the SDK. Everything in between is Zama's infrastructure — treat it like Chainlink's oracle network: a trusted external service with a defined API.
