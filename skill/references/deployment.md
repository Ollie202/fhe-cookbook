# Deployment — Sepolia

Sepolia is the canonical FHEVM testnet. Mainnet support is rolling out via the Zama Developer Program; treat addresses below as Sepolia-specific until Zama publishes mainnet equivalents.

## Wiring the config

Inherit one of:

```solidity
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {SepoliaConfig}       from "@fhevm/solidity/config/ZamaConfig.sol";

contract MyApp is ZamaEthereumConfig { ... } // recommended — auto-wires Sepolia + mainnet
```

The base contract sets the FHE coprocessor, ACL, KMS verifier, and decryption oracle addresses in the constructor. **Don't hardcode these addresses yourself**; you'll fall out of sync when Zama rotates them.

If you need to grep the live addresses, check:

```
dependencies/@fhevm-solidity-0.11.1/config/ZamaConfig.sol
```

## Hardhat deploy script

```ts
import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('deployer', deployer.address);

  const F = await ethers.getContractFactory('SealedBidAuction');
  const c = await F.deploy(/* args */);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log('SealedBidAuction', addr);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run:

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

## Foundry deploy script

```solidity
// script/Deploy.s.sol
import {Script} from "forge-std/Script.sol";
import {SealedBidAuction} from "../src/SealedBidAuction.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        new SealedBidAuction(/* args */);
        vm.stopBroadcast();
    }
}
```

```bash
forge script script/Deploy.s.sol:Deploy --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY --broadcast --verify
```

## Verifying on Etherscan

The Solidity package uses non-trivial imports + soldeer (Foundry) or npm (Hardhat) layouts. Use:

```bash
forge verify-contract <ADDR> SealedBidAuction --watch \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

Hardhat with `@nomicfoundation/hardhat-verify`:

```bash
npx hardhat verify --network sepolia <ADDR> <constructorArg1> <...>
```

## Funding

Sepolia ETH from any faucet. **No special FHEVM testnet token** — gas is plain Sepolia ETH. Note: FHE ops cost meaningfully more gas than EVM ops; budget 5–20× depending on widths.

## Post-deploy sanity checklist

- [ ] Contract verified on Etherscan
- [ ] Frontend `.env` updated with the new address
- [ ] One end-to-end test: encrypt input → tx → user-decrypt result
- [ ] If using public reveal: confirm `usePublicDecrypt` returns the right plaintext after `makePubliclyDecryptable` (no permit needed)
- [ ] ACL grants checked: a non-authorised address gets rejected by the relayer

## Mainnet considerations

- Confirm the Zama mainnet config is live before deploying.
- Gas spikes are real; consider `euint64` over `euint128`+ wherever possible.
- Treat `makePubliclyDecryptable` as irreversible. Wire it to deadlines/finality, not direct user calls.
