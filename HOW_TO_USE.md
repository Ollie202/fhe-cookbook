# How to use this

> A plain-English guide for anyone — even if you've never touched a smart contract before. If you already know your way around Solidity and just want install commands, [the README has those](README.md#install-the-skill).

This file answers, in order:

1. [What's a smart contract anyway?](#1-whats-a-smart-contract-anyway)
2. [How does someone "use" one?](#2-how-does-someone-use-one)
3. [What does each of our 5 contracts do?](#3-what-each-contract-actually-does)
4. [How do real users plug into them?](#4-how-people-plug-into-them)
5. [What's the AI agent skill for?](#5-whats-the-agent-skill-for)

---

## 1. What's a smart contract anyway?

Imagine a **vending machine that lives on the internet**. Anyone can walk up to it. You put something in, it follows the rule it was built with, output comes out. Nobody — not even the person who built it — can change the rules afterward.

That's a smart contract. **Code + data, sitting at an address, doing one job, forever.**

A "deployed" contract is the same as a vending machine you've already plugged in and turned on. People can use it right now.

## 2. How does someone "use" one?

Two requirements:

1. **A wallet** (like MetaMask) — gives the user an address, like an email but for blockchain.
2. **A way to talk to the contract** — usually a website, sometimes the blockchain explorer (Etherscan), sometimes an AI-generated tool.

Two kinds of interaction:

- **Read** (free, instant) — *"Hey contract, what's the highest bid right now?"* — costs nothing, anyone can do it.
- **Write** (small fee, ~10s) — *"Hey contract, here's my bid of 100"* — recorded permanently on the blockchain.

Our contracts are special because **writes can include encrypted values**. The blockchain sees random-looking gibberish, but the contract knows how to do math on it without ever decrypting it.

## 3. What each contract actually does

All 5 are deployed live and ready to use. (Addresses are in the [main README](README.md#live-on-sepolia) if you want to poke them on Etherscan.)

### A. ConfidentialERC20 — "secret USDC"

**What it does:** A token (like USDC or DAI) where balances are **secret**. Nobody can see how much anyone holds — not even by reading the blockchain.

**How it's used:**
1. Owner calls `mint(0xAlice, 1000)` → Alice has 1,000 secret tokens.
2. Alice calls `transfer(0xBob, 250)` → 250 silently moves to Bob.
3. Anyone calls `balanceOf(0xBob)` → returns encrypted gibberish. Only Bob can decrypt and see "250."

**What's public vs. hidden:**
- ✅ Public: Alice sent a transfer to Bob (the action).
- ❌ Hidden: how much. Could be 1 token, could be a million.

**Real-world use:** **Confidential payroll.** A company pays employees on-chain, but no coworker, no competitor, no chain-watcher can see who earns what. Each employee opens their wallet, decrypts their own balance, sees their number.

---

### B. SealedBidAuction — "auction with hidden bids"

**What it does:** An auction where every bid is **encrypted during the auction**. After the deadline, only the *winning* bid + winner are revealed. Losing bids stay secret forever.

**How it's used:**
1. Seller deploys it — *"I'm auctioning a Vintage 1985 Macintosh, deadline in 24 hours."*
2. Bidders call `bid(amount)` with their amount encrypted.
3. After deadline, anyone calls `settle()` → contract reveals the winner + winning bid. Everyone else's bid stays hidden.

**Real-world use:** **Government contract tenders.** Companies submit sealed bids. With this contract, no company can spy on competitors' numbers, no insider can leak the leading bid, and the auctioneer is provably honest because the rules are enforced by the chain.

---

### C. PrivateVote — "secret ballot, public result"

**What it does:** Voting where individual votes stay encrypted but the **final tally** becomes public.

**How it's used:**
1. Admin sets the list of eligible voters.
2. Each voter calls `vote(choice)` with their option (0, 1, or 2) encrypted.
3. After deadline, anyone calls `reveal()` → counts are published ("Option 1: 12, Option 2: 5, Option 3: 8") but **who voted for what stays hidden**.

**Real-world use:** **DAO governance.** Token holders vote on proposals without revealing their position to whales who could pressure them. Or shareholder votes where individual choices need privacy but the outcome must be auditable.

---

### D. BlindLottery — "fair random winner"

**What it does:** A truly fair lottery. Anyone can enter; after the deadline anyone can trigger the draw. The contract picks a random winner using **encrypted on-chain randomness** that nobody — including the person triggering the draw — can predict or manipulate.

**How it's used:**
1. People call `enter()` to claim a ticket.
2. After deadline, anyone calls `draw()` → winner is picked + revealed.

**Real-world use:** **Prize giveaways, NFT raffles, random validator selection.** Today these mostly use Chainlink VRF (paid oracle). This is free + native to the chain.

---

### E. ConfidentialAllowlist — "secret VIP list"

**What it does:** A members-only system where **the membership list itself is secret**. Gated functions silently no-op for non-members — they can't even tell whether they're not on the list, or the function just failed for some other reason.

**How it's used:**
1. Admin calls `grant(0xAlice)` — Alice is silently added.
2. Alice calls `gatedIncrement(50)` — her counter goes up by 50.
3. Bob (not on the list) calls the same function — contract silently does nothing.

**Real-world use:** **Whistleblower portals, private medical record access, exclusive token drops** — anywhere membership itself is sensitive. Bonus: nobody can probe the list by trying calls and watching for failures, because nothing fails visibly.

## 4. How people plug into them

Three layers, simplest to fanciest:

### Layer 1 — Block explorer (clunky but works)

A blockchain explorer like Etherscan has a "Write Contract" tab where you can fill in form fields and click buttons to call the contract directly. Works for testing. Looks ugly. No encryption helpers.

### Layer 2 — A normal frontend website

A developer builds a React/Next.js site with nice buttons. The site uses the **Zama relayer SDK** to encrypt the user's input *before* sending it to the contract. User sees a clean UI, never sees the encryption math. This is the way most real users will interact with FHE apps.

Our [`skill/references/frontend.md`](skill/references/frontend.md) teaches AI agents exactly how to build this layer.

### Layer 3 — An AI agent using this skill (the cool one)

A developer types *"build me a sealed-bid auction with a Next.js frontend"* into Claude. Claude reads this skill, generates the contract, the tests, and the frontend. **That's the whole point of this project.**

## 5. What's the agent skill for?

Developers are increasingly writing code with AI tools (Claude Code, Cursor, Windsurf), but those AI tools have never been trained on FHEVM. Ask Claude to write you a confidential auction today and you'll get nonsense — invented function names, deprecated APIs, missing encryption permissions.

**This skill is the missing manual.** It teaches AI agents:

- The **8 hard rules** they can never break
- The **18 most common bugs** with before/after code fixes
- **5 working contract templates** they can copy and adapt
- How to wire up the **frontend** with the latest Zama SDK (v3)
- How to **test** locally and **deploy** to Sepolia

With the skill installed, the same prompt that produced nonsense yesterday produces working, deployable confidential contracts today.

That's the whole pitch. Welcome to confidential smart contracts.
