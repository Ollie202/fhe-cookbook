# Access control (ACL)

The ACL is the rule for *who can use a given ciphertext handle*. Without an entry, the handle is unusable on chain (can't be read into ops next tx) and undecryptable off-chain (relayer rejects).

> **Mental model:** every handle has a permission list. The contract that produced it is automatically on the list *for the current transaction only*. Persisting the handle, or letting a user decrypt it, requires explicit grants.

## The four functions you'll actually use

```solidity
FHE.allowThis(h)              // contract keeps access in future txs (persistent)
FHE.allow(h, addr)            // grant `addr` decrypt access (persistent)
FHE.allowTransient(h, addr)   // grant `addr` access for THIS tx only
FHE.makePubliclyDecryptable(h)// anyone can decrypt — only after settlement!
```

Plus the inspectors:

```solidity
FHE.isSenderAllowed(h)        // bool — gate functions on caller having access
FHE.isAllowed(h, addr)        // bool
FHE.isPubliclyDecryptable(h)  // bool
```

## The mandatory pattern

After producing a new handle that you intend to keep:

```solidity
_state = FHE.add(_state, x);
FHE.allowThis(_state);          // future-tx access for the contract
FHE.allow(_state, msg.sender);  // user can decrypt their result
```

Miss either line and the next interaction breaks.

## When to use which grant

| Goal | Grant |
|---|---|
| Keep using a handle in future txs | `allowThis` |
| Let a specific user decrypt off-chain | `allow(h, user)` |
| Pass a handle to a helper contract within this tx | `allowTransient(h, helper)` |
| Reveal a value to everyone after settlement | `makePubliclyDecryptable` |

**Default to `allowTransient` over `allow`** when the access is only needed within the call. Persistent grants accumulate; they're the FHE equivalent of leaving sudo on.

## Gating on caller permission

```solidity
function unfreeze() external {
    require(FHE.isSenderAllowed(_balance[msg.sender]), "no access");
    // ...
}
```

This is the FHE replacement for `onlyOwner`-style modifiers when ownership is encoded as ACL state.

## Public decryption — when?

`makePubliclyDecryptable` is one-way. Use it only after the privacy boundary has expired:

- Auction settlement → reveal winner's bid only.
- Vote tally → reveal final count after the deadline.
- Confidential proposal → reveal terms after acceptance.

Never make a *user balance* publicly decryptable.

## Anti-patterns to skim

- `AP-002` — storing without `allowThis`
- `AP-003` — forgetting `allow(handle, user)`
- `AP-009` — over-broad persistent grants
- `AP-010` — external calls while holding FHE state

See [`anti-patterns.md`](anti-patterns.md).
