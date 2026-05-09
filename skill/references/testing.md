# Testing — Hardhat and Foundry

Both frameworks support FHEVM via mock mode. Use the one your project already uses.

## Hardhat — `@fhevm/hardhat-plugin`

### `hardhat.config.ts`

```ts
import '@fhevm/hardhat-plugin';
import '@nomicfoundation/hardhat-toolbox';

export default {
  solidity: {
    version: '0.8.27',
    settings: { evmVersion: 'cancun', optimizer: { enabled: true, runs: 800 } },
  },
  networks: {
    hardhat: { /* mock mode by default */ },
    sepolia: { url: process.env.SEPOLIA_RPC_URL, accounts: [process.env.PRIVATE_KEY!] },
  },
};
```

### Test pattern

```ts
import { ethers, fhevm } from 'hardhat';
import { expect } from 'chai';

describe('FHECounter', () => {
  it('increments by encrypted input', async () => {
    const [user] = await ethers.getSigners();
    const Counter = await ethers.getContractFactory('FHECounter');
    const counter = await Counter.deploy();
    await counter.waitForDeployment();

    // Build encrypted input via the plugin's helper
    const input = fhevm.createEncryptedInput(await counter.getAddress(), user.address);
    input.add32(5);
    const enc = await input.encrypt();

    await counter.connect(user).increment(enc.handles[0], enc.inputProof);

    // Read encrypted state, then user-decrypt via plugin
    const handle = await counter.getCount();
    const plain = await fhevm.userDecryptEuint(handle, await counter.getAddress(), user);
    expect(plain).to.equal(5n);
  });
});
```

In mock mode the plugin runs an in-memory FHE coprocessor — no Sepolia RPC, no relayer, no gas costs.

## Foundry — `forge-fhevm`

### `foundry.toml`

```toml
[profile.default]
src = "src"
out = "out"
libs = ["dependencies"]
test = "test"
solc = "0.8.27"
evm_version = "cancun"
optimizer = true
optimizer_runs = 800

[dependencies]
"@fhevm-solidity" = "0.11.1"
"@encrypted-types" = "0.0.4"
"@openzeppelin-confidential-contracts" = { git = "https://github.com/OpenZeppelin/openzeppelin-confidential-contracts.git", rev = "6edd293" }
forge-fhevm = { git = "https://github.com/zama-ai/forge-fhevm.git", rev = "eba2324" }
forge-std = "1.14.0"
```

### `remappings.txt`

```
@fhevm/solidity/=dependencies/@fhevm-solidity-0.11.1/
@fhevm/host-contracts/=dependencies/forge-fhevm-eba2324/src/fhevm-host/
@openzeppelin/confidential-contracts/=dependencies/@openzeppelin-confidential-contracts-6edd293/contracts/
encrypted-types/=dependencies/@encrypted-types-0.0.4/
forge-fhevm/=dependencies/forge-fhevm-eba2324/src/
forge-std/=dependencies/forge-std-1.14.0/src
```

### Test pattern

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {FhevmTest} from "forge-fhevm/FhevmTest.sol";
import {FHECounter} from "../src/FHECounter.sol";
import {externalEuint32, euint32} from "@fhevm/solidity/lib/FHE.sol";

contract FHECounterTest is FhevmTest {
    FHECounter counter;
    address user = makeAddr("user");
    uint256 userPk = 0xA11CE;

    function setUp() public override {
        super.setUp(); // installs the mock coprocessor
        counter = new FHECounter();
    }

    function test_Increment() public {
        (externalEuint32 enc, bytes memory proof) =
            encryptUint32(5, user, address(counter));

        vm.prank(user);
        counter.increment(enc, proof);

        // user-decrypt the stored count
        euint32 handle = counter.getCount();
        uint32 plain = userDecryptUint32(handle, user, address(counter), userPk);
        assertEq(plain, 5);
    }
}
```

`FhevmTest` exposes `encryptUintN(value, user, contract)` and `userDecryptUintN(handle, user, contract, pk)` helpers.

## Tips

- **Run mock mode in CI.** Sepolia tests are slow and rate-limited; reserve them for smoke tests.
- **Test ACL explicitly.** Write a test that calls a function as user A and tries to decrypt as user B — should fail.
- **Test the public-decrypt path** — after `makePubliclyDecryptable`, use `fhevm.publicDecryptEuint(FhevmType.euintN, handle)` (Hardhat) or the equivalent `forge-fhevm` helper to read the plaintext and assert.
- **Don't `vm.assume` on encrypted state.** Property-based testing of FHE state is awkward; prefer deterministic scenarios.
