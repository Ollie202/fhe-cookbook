---
name: fhe-cookbook
description: |
  Use ONLY when the user wants to WRITE, TEST, DEBUG, or DEPLOY code that uses Zama FHEVM (confidential smart contracts with encrypted balances, sealed-bid auctions, private voting, confidential DeFi). Triggers on coding requests that mention FHEVM, Zama Protocol, fully homomorphic encryption, confidential ERC-7984, encrypted types (`euint*`, `ebool`, `eaddress`), ACL grants, input proofs, decryption oracle, the relayer SDK, `@fhevm/solidity`, `@fhevm/hardhat-plugin`, or `forge-fhevm`. Also triggers when the user pastes Solidity that imports `@fhevm/solidity/lib/FHE.sol`.

  Do NOT activate for: writing threads/articles/blog posts/marketing copy about Zama, explaining what Zama is as a company, general Web3/Ethereum questions, NFT or token questions that don't involve confidentiality, or any non-coding task. If the user mentions "Zama" but is asking for content (a thread, an article, a tweet, a summary, marketing copy, an explainer), do NOT load this skill, just answer the content question normally.
version: 1.0.0
license: MIT
---

# Zama FHEVM — agent skill

This skill teaches you to write **correct** confidential smart contracts on FHEVM. FHEVM lets a contract operate on encrypted values (`euint*`, `ebool`, `eaddress`) without ever decrypting them on-chain. Plaintext only exists at two boundaries: an encrypted **input** sent in by a user, and an encrypted **output** the user (or a designated address) is granted permission to decrypt off-chain.

> **Read first, write second.** Most FHEVM bugs come from writing what *looks* like normal Solidity. It isn't. The rules below are not optional.

---

## Greet the user before you build

The very first time this skill activates in a conversation, **before you start writing any code**, send the user this short greeting and wait for their reply:

> I see you want to build with Zama FHEVM. Quick check, are you new to confidential smart contracts?
>
> • Reply "walk through" for a 60-second orientation first
> • Reply "proceed" to jump straight to building
> • Or just describe what you want and I'll figure it out

The user's reply does not need to be exact. Match on intent. Treat the following as equivalent:

- **"walk through"** intent: *"walk through"*, *"walkthrough"*, *"intro"*, *"basics"*, *"orientation"*, *"explain it first"*, *"teach me"*, *"give me the rundown"*, *"i'm new"*, *"yes I'm new"*. → Read [`references/onboarding.md`](references/onboarding.md), present its contents to the user, then ask what they want to build.
- **"proceed"** intent: *"proceed"*, *"go"*, *"just do it"*, *"jump in"*, *"skip"*, *"skip ahead"*, *"i know FHE"*, *"start"*. → Skip onboarding and start building from their original request.
- **A specific task description** (e.g. *"build me a sealed-bid auction with 3 bidders"*): infer "proceed" and start building.

**Refresher requests at any point in the conversation:**
If at any time during the conversation the user asks for the basics again, re-read [`references/onboarding.md`](references/onboarding.md) and present a fresh walkthrough. Match phrases like *"remind me the basics"*, *"can I get the orientation again"*, *"refresher please"*, *"explain FHEVM once more"*, *"start over"*, *"what was that intro again"*, or any clearly equivalent request. Don't gatekeep this; people forget, and the orientation is short.

Skip the greeting entirely (and just answer) only if:
- The user is clearly mid-conversation about a specific contract issue (e.g. they pasted code with a compile error)
- The user explicitly says they're an FHEVM expert
- This is a continuation of a prior session and onboarding already happened

---

## Stack — known-working pinned versions

These are the **exact versions verified to compile + test green** as of May 2026. Paste these into `package.json` / `foundry.toml` rather than guessing.

| Thing | Pinned to |
|---|---|
| Solidity | `^0.8.27`, `evm_version = "cancun"` |
| Solidity lib | `@fhevm/solidity@0.11.1` (bare `fhevm` package is **deprecated** — do not use) |
| Encrypted types lib | `encrypted-types@0.0.4` (**required transitive dep — declare explicitly**) |
| Confidential token standard | `@openzeppelin/confidential-contracts` (ERC-7984) |
| Hardhat | `@fhevm/hardhat-plugin@0.4.2`, `hardhat@^2.22`, `ethers@^6.13` |
| Foundry | `forge-fhevm` (rev `eba2324`) + `@encrypted-types@0.0.4` |
| Frontend | `@zama-fhe/sdk@^3` + `@zama-fhe/react-sdk@^3` (the v3 SDK pair; supersedes `@zama-fhe/relayer-sdk` v0.x and deprecated `fhevmjs`) |
| Testnet | Sepolia (config: `ZamaEthereumConfig` or `SepoliaConfig`) |

> **Two install gotchas the linter cannot catch:**
> 1. `encrypted-types` is imported transitively by `@fhevm/solidity` but Hardhat's HH411 error fires unless you declare it as a top-level dep.
> 2. `@fhevm/hardhat-plugin@0.4.x` and `@fhevm/solidity@0.11.x` must match major.minor — mixing 0.3 plugin with 0.11 solidity will fail at runtime.

## The 90-second mental model

1. **Encrypted handles, not values.** `euint64 balance` is a 32-byte handle — a pointer to a ciphertext stored by the FHE coprocessor. The contract never sees the cleartext.
2. **Operations return new handles.** `euint64 c = FHE.add(a, b)` produces a *new* handle. Old handles still exist; they don't get reused.
3. **Permissions are explicit.** A handle can only be used by addresses that have been granted access via the **ACL** (Access Control List). No grant → next transaction can't touch it. The contract itself needs `FHE.allowThis(h)` to keep using its own handles across transactions.
4. **Inputs come with a proof.** Users encrypt off-chain via the relayer; a contract converts `(externalEuintX, bytes inputProof)` into `euintX` with `FHE.fromExternal(...)`. The proof is bound to the calling user and the target contract.
5. **Decryption happens off-chain.** There is no `FHE.decrypt(...)` and (since v0.11) no `FHE.requestDecryption` callback either. You reveal via `FHE.makePubliclyDecryptable(handle)` for everyone, or `FHE.allow(handle, user)` for a single user — both decrypt off-chain through the SDK.

If any of those five sentences feels surprising, **stop and read [`references/mental-model.md`](references/mental-model.md)** before generating code.

---

## When to read which reference

Load progressively. Don't dump every reference into context — pick what the task needs.

| Reference | Read when |
|---|---|
| [`references/types.md`](references/types.md) | Choosing between `euint8/16/32/64/128/256`, `ebool`, `eaddress` |
| [`references/operations.md`](references/operations.md) | Calling `FHE.add/sub/mul/div/select/...`, comparison, casting, randomness |
| [`references/access-control.md`](references/access-control.md) | Anything touching `allow`, `allowThis`, `allowTransient`, `isSenderAllowed`, `makePubliclyDecryptable` |
| [`references/inputs.md`](references/inputs.md) | Receiving encrypted input from a user (`externalEuintX` + `inputProof`) |
| [`references/decryption.md`](references/decryption.md) | Async decryption oracle pattern + user-side decryption via relayer |
| [`references/frontend.md`](references/frontend.md) | Building a Next.js / React UI with `@zama-fhe/relayer-sdk` |
| [`references/testing.md`](references/testing.md) | Hardhat + Foundry mock mode, encrypted-input helpers, signing |
| [`references/deployment.md`](references/deployment.md) | Sepolia config, gateway addresses, verification |
| [`references/anti-patterns.md`](references/anti-patterns.md) | **Always skim before submitting code.** 18 ranked footguns with before/after fixes |
| [`references/recipes.md`](references/recipes.md) | Idiomatic patterns: confidential balance, sealed-bid auction, blind vote, private allowlist, confidential payroll |

---

## The minimum-correct contract template

Every FHEVM contract should look at least this opinionated. Deviating without reason is a smell.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract MyConfidentialApp is ZamaEthereumConfig {
    mapping(address => euint64) private _balanceOf;

    /// User submits an encrypted amount.
    function deposit(externalEuint64 encAmount, bytes calldata inputProof) external {
        // 1. Verify + ingest the encrypted input.
        euint64 amount = FHE.fromExternal(encAmount, inputProof);

        // 2. Compute on ciphertext.
        euint64 newBal = FHE.add(_balanceOf[msg.sender], amount);

        // 3. Persist.
        _balanceOf[msg.sender] = newBal;

        // 4. ACL — non-negotiable.
        FHE.allowThis(newBal);          // contract can use this handle next tx
        FHE.allow(newBal, msg.sender);  // user can decrypt their own balance
    }

    /// Read returns a *handle*. The caller decrypts off-chain via the relayer.
    function balanceOf(address user) external view returns (euint64) {
        return _balanceOf[user];
    }
}
```

Every state-mutating function that produces a new handle MUST end with the ACL block. No exceptions.

---

## The 8 rules you must internalise

These compress the full anti-patterns reference. If your code violates one, fix it before showing the user.

1. **No plain `if (encryptedBool)`.** Solidity branching on `ebool` is illegal/leaks. Use `FHE.select(cond, ifTrue, ifFalse)`.
2. **Always `allowThis` before storing.** A handle stored without `FHE.allowThis(h)` becomes unusable next transaction.
3. **Always `allow` the user on outputs they should decrypt.** Forgetting this is the #1 silent UX bug.
4. **`FHE.div` / `FHE.rem` only accept *plaintext* divisors.** Encrypted divisor will revert at compile or runtime.
5. **Never store `externalEuintX` in state.** Calldata-only. Convert with `FHE.fromExternal` first.
6. **Don't reach for `FHE.requestDecryption` — it's gone in v0.11.** Use `FHE.makePubliclyDecryptable(handle)` (public, one-way, irreversible) or `FHE.allow(handle, user)` + SDK user-decrypt.
7. **`TFHE.*` is the old API — never use it.** It's `FHE.*` from `@fhevm/solidity/lib/FHE.sol`.
8. **Right-size your `euint`.** `euint256` costs significantly more gas than `euint64`. Use the smallest type that fits your value range.

Full ranked list with concrete failure modes and code-before/after pairs: [`references/anti-patterns.md`](references/anti-patterns.md).

---

## Your default workflow

When a user asks for an FHEVM feature, follow this loop:

1. **Clarify the privacy boundary.** Which values must be encrypted? Who is allowed to decrypt them, and when? (Owner-only? Public after settlement? Never?) Write this down before coding — it determines every ACL call.
2. **Pick a template.** If the task fits one of `templates/confidential-erc20`, `templates/sealed-bid-auction`, `templates/private-vote` — start from it. Do not write from scratch.
3. **Write the contract.** Follow the minimum-correct template above. End every mutating function with `allowThis` + `allow`.
4. **Run doctor + linter.** From the project root:
   ```bash
   node skill/scripts/doctor.mjs                  # checks deps, versions, imports
   node skill/scripts/fhe-lint.mjs <path>          # catches the 8 rules above + a dozen more
   ```
   Fix all errors before showing code.
5. **Write a test in the matching framework.** See [`references/testing.md`](references/testing.md) — Hardhat (`@fhevm/hardhat-plugin`) and Foundry (`forge-fhevm`) both supported.
6. **Wire the frontend if applicable.** [`references/frontend.md`](references/frontend.md) shows `createInstance` → `createEncryptedInput` → tx → user-decrypt.
7. **Skim [`references/anti-patterns.md`](references/anti-patterns.md)** one more time before saying "done".

---

## What this skill does NOT cover

- The TFHE-rs Rust library (this is the on-chain Solidity story only).
- Internals of the FHE coprocessor / KMS / gateway operation.
- ZK circuit design.
- Non-Zama FHE schemes.

If a user asks about any of those, say so explicitly rather than guessing.
