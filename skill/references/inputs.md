# Encrypted inputs

How a user gets ciphertext into your contract.

## The shape of an encrypted input

A user-submitted encrypted value arrives in two pieces:

```solidity
function deposit(externalEuint64 encAmount, bytes calldata inputProof) external;
```

- `externalEuint64` — a calldata-only handle (32 bytes packed as `bytes32`).
- `inputProof` — a zero-knowledge proof that the encrypted value was correctly formed and is bound to **(this caller, this contract)**.

You convert it to a usable `euint64` with:

```solidity
euint64 amount = FHE.fromExternal(encAmount, inputProof);
```

`fromExternal` will revert if the proof is invalid, expired, or bound to a different caller/contract.

## Multiple inputs in one call

You can accept several encrypted inputs sharing one proof:

```solidity
function trade(
    externalEuint64 encGive,
    externalEuint64 encGet,
    bytes calldata inputProof
) external {
    euint64 give = FHE.fromExternal(encGive, inputProof);
    euint64 get  = FHE.fromExternal(encGet, inputProof);
    // ...
}
```

The frontend bundles them via `createEncryptedInput`:

```ts
const input = instance.createEncryptedInput(contractAddr, userAddr);
input.add64(giveAmount);
input.add64(getAmount);
const { handles, inputProof } = await input.encrypt();
// handles[0] = encGive, handles[1] = encGet
```

## Validating inputs server-side

`fromExternal` proves *well-formedness* and *binding*. It does **not** prove the value is in a sensible range. If your contract requires `0 < amount <= MAX`, enforce it with FHE-comparison + select:

```solidity
euint64 amt = FHE.fromExternal(encAmount, inputProof);
ebool ok = FHE.and(FHE.gt(amt, FHE.asEuint64(0)), FHE.le(amt, FHE.asEuint64(MAX)));
amt = FHE.select(ok, amt, FHE.asEuint64(0)); // clamp invalid to 0 (or revert via decrypted ack)
```

You can't `require(ok)` directly — it's an `ebool`. Either clamp like above, or request decryption of `ok` to enforce.

## Common mistakes

- **Storing `externalEuint*` in state** → AP-005. Always convert first.
- **Trusting one contract's proof in another** → AP-013. Proofs are bound; re-encrypt for the actual target.
- **Encrypting nonce/counter values that don't need to be secret** — wastes gas. Use plaintext for things that aren't sensitive.
- **Forgetting `inputProof` is `bytes calldata`** — declaring it as `memory` works but costs more gas.
