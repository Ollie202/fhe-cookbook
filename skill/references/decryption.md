# Decryption — the v0.11 reality

> **Important correction.** Earlier FHEVM versions exposed a synchronous-looking but actually-async `FHE.requestDecryption(...)` callback pattern. **That API is gone in `@fhevm/solidity@0.11`.** The library now ships only two paths to plaintext, both off-chain.

| Pattern | Plaintext arrives where? | Use when |
|---|---|---|
| **User decryption** (off-chain via SDK) | The user's browser | Only a user needs the value (their balance, their bid). Default choice. |
| **Public decryption** (off-chain, anyone) | Any observer's browser | A value must be revealed to everyone after some condition (auction settled, vote ended). |

There is **no on-chain async oracle in v0.11**. If your contract logic itself needs the cleartext to act on it, you have to redesign: either reveal publicly and have the next caller pass the cleartext back in (with a proof of correct decryption), or do everything in encrypted form using `FHE.select` and only reveal at the end.

---

## Pattern A — user decryption

The contract grants the user access:

```solidity
mapping(address => euint64) private _balance;

function deposit(externalEuint64 enc, bytes calldata proof) external {
    euint64 amt = FHE.fromExternal(enc, proof);
    _balance[msg.sender] = FHE.add(_balance[msg.sender], amt);
    FHE.allowThis(_balance[msg.sender]);
    FHE.allow(_balance[msg.sender], msg.sender); // <-- key line
}

function balanceOf(address u) external view returns (euint64) {
    return _balance[u];
}
```

Frontend reads the handle, then asks the SDK to decrypt. With the v3 React SDK:

```ts
import { useUserDecrypt, useAllow, useIsAllowed } from '@zama-fhe/react-sdk';
import { ZERO_HANDLE } from '@zama-fhe/sdk';

const { mutate: allow } = useAllow();
const { data: isAllowed } = useIsAllowed({ contractAddresses: [CONTRACT] });

const handles = handle && handle !== ZERO_HANDLE
  ? [{ handle, contractAddress: CONTRACT }]
  : [];
const decrypt = useUserDecrypt({ handles }, { enabled: !!isAllowed });

if (!isAllowed) allow([CONTRACT]);
const plaintext = decrypt.data?.[handle as `0x${string}`]; // bigint
```

The hook handles keypair generation, EIP-712 signing, and caching internally. See [`frontend.md`](frontend.md) for the full provider setup.

---

## Pattern B — public decryption

After the privacy boundary expires (deadline reached, condition met), the contract calls `FHE.makePubliclyDecryptable(handle)`. Anyone can then decrypt that specific handle off-chain.

```solidity
function settle() external {
    require(block.timestamp >= deadline, "running");
    require(!settled, "already settled");
    settled = true;

    FHE.makePubliclyDecryptable(_highestBid);
    FHE.makePubliclyDecryptable(_highestBidder);

    emit Settled();
}
```

Frontend (no permit needed):

```ts
import { usePublicDecrypt } from '@zama-fhe/react-sdk';

const { data } = usePublicDecrypt({
  handles: [
    { handle: bidHandle, contractAddress: CONTRACT },
    { handle: winnerHandle, contractAddress: CONTRACT },
  ],
});
const winningBid = data?.[bidHandle];
const winner    = data?.[winnerHandle];
```

In Hardhat tests:

```ts
import { FhevmType } from '@fhevm/hardhat-plugin';
const bidPlain    = await fhevm.publicDecryptEuint(FhevmType.euint64, bidHandle);
const winnerPlain = await fhevm.publicDecryptEaddress(winnerHandle);
```

## Public decryption is one-way

Once a handle has been made publicly decryptable, you cannot un-publish it. Wire it to deadlines/finality, never to direct user calls. Don't ever call it on a user balance.

## Pitfalls — see anti-patterns.md

- AP-009 — over-broad persistent `allow` grants
- AP-010 — external calls while holding FHE state
- AP-018 — reorg-induced double disclosure (request a public decrypt, chain reorgs, your "secret" was committed in two competing histories)

> If you find documentation referencing `FHE.requestDecryption(...)` callbacks: it predates `@fhevm/solidity@0.11`. Cross-check the version before copying patterns.
