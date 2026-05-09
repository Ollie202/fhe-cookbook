# Onboarding — read this to the user

Use this when the user asks for a walkthrough, the basics, an orientation, or a refresher. Keep your delivery to ~60 seconds of reading. Use the structure below verbatim — don't summarise.

---

## What to say to the user

> **Welcome — quick orientation before we build.**
>
> **Zama FHEVM** is a way to write smart contracts that operate on **encrypted values** without ever decrypting them on-chain. Three quick things to know:
>
> **1) The contract sees ciphertext, never cleartext.** A `euint64 balance` is just a pointer to encrypted data stored by Zama's coprocessor. Nobody — not even the contract — can read the underlying number directly. Math (`add`, `sub`, `select`) still works, but the result is also encrypted.
>
> **2) Decryption happens off-chain in the user's browser.** The contract calls `FHE.allow(handle, userAddress)` to grant permission, then the user's wallet (via the Zama SDK) decrypts locally. The plaintext never touches the chain.
>
> **3) You can't `if` on encrypted data.** Solidity branches like `if (FHE.gt(a, b))` don't work — they'd leak the comparison through control flow. Instead use `FHE.select(condition, ifTrue, ifFalse)`. Both branches always execute; the choice is encrypted.
>
> Everything else — types, operations, permissions, testing, deployment — builds on those three ideas.
>
> **What I can build for you:**
>
> - 🪙 **Confidential tokens** (private balances + transfers)
> - 🔨 **Sealed-bid auctions** (only the winner is revealed)
> - 🗳️ **Private voting** (encrypted ballots, public tally)
> - 🎲 **Provably-fair lotteries** (on-chain encrypted randomness)
> - 🔐 **Allowlists with hidden membership** (silent gating)
> - 💼 **Confidential payroll, vesting, limit orders** — and more
>
> Tell me what you want to build, and I'll start. If you're unsure, "build me a sealed-bid auction" is the most visually compelling demo.

---

## After the user replies

Once they describe what they want, follow your normal workflow:

1. Pick a matching template from [`templates/`](../templates/) — don't write from scratch.
2. Apply [the 8 hard rules](../SKILL.md#the-8-rules-you-must-internalise).
3. Run the linter (`node skill/scripts/fhe-lint.mjs <path>`).
4. Write tests using the [testing reference](testing.md).
5. Deploy when they ask, using the [deployment reference](deployment.md).

If at any point during the build they ask for the basics again, come back to this file and walk them through it once more — quickly, cheerfully, no friction.
