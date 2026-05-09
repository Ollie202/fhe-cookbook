# Recipes — idiomatic FHEVM patterns

Snippets to compose from. Each is a fragment, not a full contract — drop into the [minimum-correct template](../SKILL.md#the-minimum-correct-contract-template) and adjust.

## Confidential balance (ERC-20-shaped)

```solidity
mapping(address => euint64) private _balance;

function _credit(address to, euint64 amount) internal {
    _balance[to] = FHE.add(_balance[to], amount);
    FHE.allowThis(_balance[to]);
    FHE.allow(_balance[to], to);
}

function _debit(address from, euint64 amount) internal returns (euint64 actual) {
    ebool enough = FHE.le(amount, _balance[from]);
    actual = FHE.select(enough, amount, FHE.asEuint64(0));
    _balance[from] = FHE.sub(_balance[from], actual);
    FHE.allowThis(_balance[from]);
    FHE.allow(_balance[from], from);
}
```

The `actual` return lets callers detect under-balance without learning the balance — see AP-012 for why this matters.

## Sealed-bid auction (highest bid wins)

```solidity
euint64 private _highestBid;
eaddress private _highestBidder;

function bid(externalEuint64 encBid, bytes calldata proof) external {
    require(block.timestamp < deadline, "closed");
    euint64 newBid = FHE.fromExternal(encBid, proof);

    ebool isHigher = FHE.gt(newBid, _highestBid);
    _highestBid    = FHE.select(isHigher, newBid, _highestBid);
    _highestBidder = FHE.select(isHigher, FHE.asEaddress(msg.sender), _highestBidder);

    FHE.allowThis(_highestBid);
    FHE.allowThis(_highestBidder);
}

function settle() external {
    require(block.timestamp >= deadline, "running");
    FHE.makePubliclyDecryptable(_highestBid);
    FHE.makePubliclyDecryptable(_highestBidder);
}
```

Pure branchless. Each bid pays one comparison + two selects.

## Blind vote with running tally

```solidity
mapping(uint8 => euint32) private _tally;
mapping(address => bool) private _voted;

function vote(externalEuint8 encChoice, bytes calldata proof) external {
    require(!_voted[msg.sender] && block.timestamp < deadline, "no");
    _voted[msg.sender] = true;
    euint8 choice = FHE.fromExternal(encChoice, proof);

    for (uint8 i = 0; i < OPTIONS; i++) {
        ebool match_ = FHE.eq(choice, FHE.asEuint8(i));
        _tally[i] = FHE.add(_tally[i], FHE.select(match_, FHE.asEuint32(1), FHE.asEuint32(0)));
        FHE.allowThis(_tally[i]);
    }
}

function reveal() external {
    require(block.timestamp >= deadline, "running");
    for (uint8 i = 0; i < OPTIONS; i++) {
        FHE.makePubliclyDecryptable(_tally[i]);
    }
}
```

Loop over options is fixed-width (privacy-safe). Don't loop over voters — that leaks per-user info.

## Private allowlist gate

```solidity
mapping(address => ebool) private _allowed;

function admit(address who) external onlyAdmin {
    _allowed[who] = FHE.asEbool(true);
    FHE.allowThis(_allowed[who]);
    FHE.allow(_allowed[who], who);
}

function gatedAction(externalEuint64 encArg, bytes calldata proof) external {
    require(FHE.isSenderAllowed(_allowed[msg.sender]), "unknown caller");
    ebool ok = _allowed[msg.sender];
    euint64 arg = FHE.fromExternal(encArg, proof);
    euint64 effect = FHE.select(ok, arg, FHE.asEuint64(0));
    // apply effect; non-allowed callers no-op silently
}
```

Note `isSenderAllowed` is plaintext (it inspects ACL membership, not the bool value), so it's safe to use in `require`.

## Confidential payroll batch

```solidity
function payBatch(
    address[] calldata employees,
    externalEuint64[] calldata encAmounts,
    bytes calldata sharedProof
) external onlyEmployer {
    require(employees.length == encAmounts.length, "len");
    for (uint256 i = 0; i < employees.length; i++) {
        euint64 amt = FHE.fromExternal(encAmounts[i], sharedProof);
        _credit(employees[i], amt);
    }
}
```

One shared proof for the whole batch. The frontend builds it with multiple `add64` calls before `encrypt()`.

## Settle-and-reveal (auction)

`@fhevm/solidity@0.11` has no on-chain async decryption oracle. The pattern: make the result publicly decryptable on-chain, then have the frontend (or any settlement bot) read the cleartext and call back to perform the payout.

```solidity
function settle() external {
    require(block.timestamp >= deadline, "running");
    require(!settled, "settled");
    settled = true;
    FHE.makePubliclyDecryptable(_highestBid);
    FHE.makePubliclyDecryptable(_highestBidder);
}

/// @notice Off-chain bot decrypts publicly, then calls this with the plaintext.
///         The contract re-checks via the SDK proof bytes.
function payout(uint64 winningBid, address winner, bytes calldata sdkProof) external {
    require(settled, "not settled");
    // Verify against the on-chain handles using the v3 SDK's public-decrypt proof bytes.
    // (See `references/decryption.md`; OZ's confidential-contracts ship a verifier.)
    payable(seller).transfer(winningBid);
    nft.transferFrom(address(this), winner, tokenId);
}
```

If you want the payout to be fully on-chain without a bot, redesign so the *encrypted* winner address pays out via a confidential-token transfer that doesn't need plaintext (only the recipient's address handle).
