# Deploying to Sepolia

You need:

- A Sepolia private key with ~0.05 ETH (any faucet)
- A Sepolia RPC URL (Alchemy, Infura, or `https://ethereum-sepolia.publicnode.com`)
- An Etherscan API key (free) for verification

## 1. Set env

```bash
export SEPOLIA_RPC_URL="https://..."
export PRIVATE_KEY="0x..."
export ETHERSCAN_API_KEY="..."
```

## 2. Deploy via Foundry (recommended — faster + auto-verifies)

```bash
cd contracts
forge soldeer install
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast --verify \
  -vvv
```

Output will print the three contract addresses. Save them.

## 2-bis. Deploy via Hardhat (alternative)

```bash
cd hardhat
pnpm install
pnpm deploy:sepolia
```

## 3. Wire the frontend

```bash
cp frontend/.env.example frontend/.env
# Edit:
# NEXT_PUBLIC_AUCTION_ADDRESS=<the address forge printed>
# NEXT_PUBLIC_TOKEN_ADDRESS=<...>
# NEXT_PUBLIC_VOTE_ADDRESS=<...>
cd frontend && pnpm install && pnpm dev
```

Open http://localhost:3000.

## 4. Smoke test

1. Connect wallet (Sepolia).
2. Place a bid like `250`.
3. Wait for tx confirmation in the activity log.
4. Open the contract on Sepolia Etherscan — confirm the bid input is opaque ciphertext.
5. Wait for the auction deadline (or redeploy with shorter duration).
6. Click **Settle auction**. The decryption oracle fires within ~30-60s.
7. Winner + winning bid appear.

## Troubleshooting

- **`relayer-sdk` init hangs** — the relayer can be slow on cold connections. Wait 5-10s, or warm it up before recording demos.
- **`userDecrypt` rejected** — the contract didn't call `FHE.allow(handle, user)`. Re-check the ACL pattern.
- **Verification fails on Etherscan** — pass `--via-ir` if your Solidity uses heavy stack; or verify manually with `forge verify-contract`.
- **Bid tx reverts with `ACL: not authorized`** — the input proof is bound to a specific (caller, contract) pair. Check the frontend is encrypting for the actual auction address from `.env`, not a stale one.
