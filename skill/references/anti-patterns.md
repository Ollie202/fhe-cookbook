# FHEVM anti-patterns — ranked

The 18 footguns most likely to ship broken or insecure FHEVM code. Each entry is **Symptom → Why → Fix** with a code-before/after pair. Sourced from the OpenZeppelin FHEVM security guide, Zama's official docs, and observed mistakes.

> **Skim this whole file before submitting any FHEVM code you wrote.** If your code matches the "before" pattern of any item, replace it with the "after" pattern.

---

## AP-001 — Branching on an encrypted bool

**Symptom:** `if (FHE.gt(a, b)) { ... }` — won't compile, or worse, leaks the comparison via control flow.

**Why:** `ebool` is a ciphertext handle, not a `bool`. The EVM cannot evaluate it. Even if you cast it, branching reveals the result.

**Before**

```solidity
ebool isHigher = FHE.gt(newBid, highestBid);
if (isHigher) { highestBid = newBid; } // ❌ illegal & leaks
```

**After**

```solidity
ebool isHigher = FHE.gt(newBid, highestBid);
highestBid = FHE.select(isHigher, newBid, highestBid); // ✅ branchless
FHE.allowThis(highestBid);
```

---

## AP-002 — Storing without `FHE.allowThis`

**Symptom:** Contract reverts on the *next* call when it tries to read its own state. Cryptic `ACL: not authorized`.

**Why:** Persisting a handle to storage doesn't grant the contract access. The ACL is per-handle and per-tx unless explicitly extended.

**Before**

```solidity
_balance[user] = FHE.add(_balance[user], amount); // ❌ no allowThis
```

**After**

```solidity
euint64 newBal = FHE.add(_balance[user], amount);
_balance[user] = newBal;
FHE.allowThis(newBal); // ✅
FHE.allow(newBal, user);
```

---

## AP-003 — Forgetting to grant the user

**Symptom:** User's wallet shows nothing. Frontend `userDecrypt` call fails with `not allowed`.

**Why:** A handle the contract just produced is invisible to the user until you call `FHE.allow(handle, user)`.

**Before**

```solidity
function balanceOf(address u) external view returns (euint64) {
    return _balance[u]; // ❌ caller may not be allowed
}
```

**After**

```solidity
function refreshAccess() external {
    FHE.allow(_balance[msg.sender], msg.sender); // ✅
}
// or grant inside the same tx that produced the handle
```

---

## AP-004 — Encrypted divisor in `FHE.div` / `FHE.rem`

**Symptom:** Compile error or runtime revert.

**Why:** Division/remainder are only supported with a *plaintext* divisor for performance reasons.

**Before**

```solidity
euint32 q = FHE.div(numer, denom); // ❌ both encrypted
```

**After**

```solidity
euint32 q = FHE.div(numer, uint32(10)); // ✅ plaintext divisor
```

If you genuinely need encrypted division, restructure: precompute reciprocals off-chain or use repeated subtraction with bounded loops.

---

## AP-005 — Storing `externalEuintX` in state

**Symptom:** Compiler accepts it; runtime panics or behaves bizarrely.

**Why:** `externalEuintX` is a calldata-side handle bound to the input proof. It is not valid storage data.

**Before**

```solidity
mapping(address => externalEuint64) _staged; // ❌
function stage(externalEuint64 e) external { _staged[msg.sender] = e; }
```

**After**

```solidity
mapping(address => euint64) _staged; // ✅
function stage(externalEuint64 e, bytes calldata proof) external {
    euint64 v = FHE.fromExternal(e, proof);
    _staged[msg.sender] = v;
    FHE.allowThis(v);
}
```

---

## AP-006 — Reaching for `FHE.requestDecryption` (the API isn't there)

**Symptom:** Compile-time `Member "requestDecryption" not found or not visible after argument-dependent lookup in type(library FHE)`.

**Why:** `@fhevm/solidity@0.11` removed the on-chain async decryption oracle pattern. There is **no** `requestDecryption(...) → onDecrypted(uint256, bytes, bytes)` callback in the live library. Older tutorials and pre-0.11 code still show it.

**Before**

```solidity
// ❌ doesn't compile in v0.11
bytes32[] memory cts = new bytes32[](1);
cts[0] = euint64.unwrap(_value);
FHE.requestDecryption(cts, this.onDecrypted.selector);

function onDecrypted(uint256, bytes memory ct, bytes memory pf) public {
    FHE.checkSignatures(_handles[reqId], ct, pf);
    // ...
}
```

**After — pick one of two replacements**

```solidity
// (a) PUBLIC reveal: anyone can decrypt off-chain via the SDK after this point
function settle() external {
    require(block.timestamp >= deadline, "running");
    FHE.makePubliclyDecryptable(_value);   // one-way; treat as final
}
```

```solidity
// (b) USER-SCOPED reveal: only this address can decrypt off-chain
FHE.allow(_value, recipient);              // SDK userDecrypt picks it up
```

If your contract's *own* logic needs the cleartext to act on it: redesign — keep computing in encrypted form with `FHE.select`, then reveal at the end. There is no synchronous decryption in v0.11.

---

## AP-007 — Information disclosure across reorgs

**Symptom:** A handle was made publicly decryptable in an early block; chain reorgs and the secret is now publicly correlated with two competing histories.

**Why:** `makePubliclyDecryptable` is durable and one-way. Reorgs replay the call.

**Fix:** Wait `N` confirmations before triggering reveal. For high-stakes use, gate behind a finality-aware oracle or a long enough deadline buffer.

---

## AP-008 — Treating reveal as reversible

**Symptom:** Contract calls `makePubliclyDecryptable` then later wants to "un-publish" the value.

**Why:** There is no inverse. The handle stays publicly decryptable for its lifetime.

**Fix:** Don't apply public reveal to anything that might need to be recalled. Reveal the *result* of a computation, not the inputs. For multi-stage protocols, derive a fresh handle for each disclosure step.

---

## AP-009 — Over-broad persistent ACL grants

**Symptom:** Old handles remain decryptable by addresses that should no longer have access; information leaks.

**Why:** `FHE.allow` persists. Use `FHE.allowTransient` when the access is only needed within the current call.

**Before**

```solidity
FHE.allow(secret, msg.sender); // ❌ persists forever
```

**After**

```solidity
FHE.allowTransient(secret, msg.sender); // ✅ scoped to this tx
// or, gate with `isSenderAllowed` at function entry instead of granting
```

---

## AP-010 — Arbitrary external calls while holding FHE state

**Symptom:** A malicious target contract calls back into yours, abusing transient ACL grants.

**Why:** Transient grants are tx-scoped, not call-scoped. Arbitrary external calls inside an FHE-touching function turn the callee into a disclosure oracle.

**Fix:** Don't make untrusted external calls between `allowTransient` and the end of the tx. If you must, call `FHE.cleanTransientStorage()` between them.

---

## AP-011 — Silent overflow on `FHE.add`

**Symptom:** A balance wraps from `2**64 - 1` to small. No revert.

**Why:** FHE arithmetic is modular; there's no built-in overflow check.

**Before**

```solidity
balance = FHE.add(balance, amount); // ❌ may wrap silently
```

**After**

```solidity
ebool willOverflow = FHE.lt(FHE.add(balance, amount), balance);
balance = FHE.select(willOverflow, balance, FHE.add(balance, amount)); // ✅ clamp
FHE.allowThis(balance);
```

Or right-size the type so overflow is impossible for your value range.

---

## AP-012 — Ignoring effective transferred amount

**Symptom:** Sealed-bid auction credits the bidder for a 100-token bid even though their confidential balance was 0; the transfer silently moved 0.

**Why:** Confidential token transfers can succeed with `transferred = 0` if the sender lacked balance — without reverting.

**Before**

```solidity
token.confidentialTransferFrom(bidder, address(this), bid);
_credit[bidder] = bid; // ❌ assumes bid actually moved
```

**After**

```solidity
euint64 moved = token.confidentialTransferFrom(bidder, address(this), bid);
_credit[bidder] = FHE.add(_credit[bidder], moved); // ✅ use actual amount
FHE.allowThis(_credit[bidder]);
```

---

## AP-013 — Trusting input proofs across contracts

**Symptom:** Encrypted input encrypted to contract A is forwarded to contract B and accepted.

**Why:** `(externalEuintX, proof)` is bound to a (caller, target) pair. Don't pipe it through a proxy.

**Fix:** Re-encrypt via the relayer for the actual target contract. Don't accept relayed input proofs.

---

## AP-014 — `delegatecall` from FHE-holding contracts

**Symptom:** Delegatecallee uses your contract's ACL grants in unexpected ways.

**Why:** Delegatecall inherits the caller's storage and ACL identity.

**Fix:** Avoid `delegatecall` in FHE-holding contracts. If unavoidable, audit the target's FHE.* usage as if it were your own code.

---

## AP-015 — Oversizing `euint`

**Symptom:** Gas costs 5–10× what they should.

**Why:** FHE op cost scales with bit width. `euint256` ops are dramatically more expensive than `euint64`.

**Fix:** Right-size. A confidential ERC-20 with 6 decimals fits comfortably in `euint64`. Reach for `euint128`+ only when the value range demands it.

---

## AP-016 — Legacy `TFHE` imports

**Symptom:** Compile fails or types don't line up with the relayer.

**Why:** `TFHE` was the pre-`@fhevm/solidity@0.7+` API. The current API is `FHE` from `@fhevm/solidity/lib/FHE.sol`.

**Before**

```solidity
import "fhevm/lib/TFHE.sol"; // ❌ deprecated
TFHE.allow(x, msg.sender);
```

**After**

```solidity
import {FHE} from "@fhevm/solidity/lib/FHE.sol"; // ✅
FHE.allow(x, msg.sender);
```

---

## AP-017 — Account-abstraction transient leakage

**Symptom:** Multiple userOps bundled into one tx share transient FHE storage; private state from op 1 visible to op 2.

**Why:** Transient storage and transient ACL grants live for the whole transaction, not the userOp.

**Fix:** Call `FHE.cleanTransientStorage()` at userOp boundaries inside the AA wallet's execution flow.

---

## AP-018 — Information disclosure across reorgs

**Symptom:** A decrypted result is broadcast in an early block; chain reorgs and the secret is now publicly correlated with two competing histories.

**Why:** Decryption requests are durable. Reorgs can replay them in different orderings.

**Fix:** Two-step disclosure — request decryption, then settle in a function that requires N additional confirmations of finality before acting on the result. For high-stakes use, gate behind a finality-aware oracle.

---

## How to use this list

When you finish a contract, run:

```bash
node skill/scripts/fhe-lint.mjs path/to/Contract.sol
```

The linter encodes most of the rules above. If it passes, do one more visual pass against AP-009, AP-010, AP-013, AP-018 — those need contract-context judgement the linter can't make.
