// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, ebool, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ConfidentialAllowlist — gated actions with encrypted membership
/// @notice The admin maintains an encrypted membership flag per address.
///         Members can call gated functions; non-members get a silent no-op
///         (no revert, no event — they can't even tell whether they're listed
///         without decrypting their own flag).
/// @dev Showcases `ebool` storage, `FHE.isSenderAllowed` for ACL gating,
///      and the silent-no-op pattern for membership-private gating.
contract ConfidentialAllowlist is ZamaEthereumConfig {
    address public immutable admin;

    mapping(address => ebool) private _allowed;
    mapping(address => euint64) public counter;

    event Granted(address indexed who);
    event Revoked(address indexed who);
    event GatedActionCalled(address indexed caller); // intentionally fires for everyone — no membership leak

    constructor() {
        admin = msg.sender;
    }

    /// @notice Admin grants access. The bool is *encrypted* — observers can
    ///         see that admin called `grant(addr)` but cannot tell whether
    ///         the flag was set true or false from on-chain data alone.
    function grant(address who) external {
        require(msg.sender == admin, "not admin");
        ebool t = FHE.asEbool(true);
        _allowed[who] = t;
        FHE.allowThis(_allowed[who]);
        FHE.allow(_allowed[who], who); // member can decrypt their own flag
        emit Granted(who);
    }

    function revoke(address who) external {
        require(msg.sender == admin, "not admin");
        ebool f = FHE.asEbool(false);
        _allowed[who] = f;
        FHE.allowThis(_allowed[who]);
        FHE.allow(_allowed[who], who);
        emit Revoked(who);
    }

    function isAllowed(address who) external view returns (ebool) {
        return _allowed[who];
    }

    /// @notice A gated action with a confidential argument. Members get the
    ///         effect; non-members silently no-op — observers cannot tell which.
    function gatedIncrement(externalEuint64 encDelta, bytes calldata inputProof) external {
        ebool flag = _allowed[msg.sender];
        euint64 delta = FHE.fromExternal(encDelta, inputProof);

        // Branchless gate: effective delta = flag ? delta : 0
        euint64 effective = FHE.select(flag, delta, FHE.asEuint64(0));

        counter[msg.sender] = FHE.add(counter[msg.sender], effective);
        FHE.allowThis(counter[msg.sender]);
        FHE.allow(counter[msg.sender], msg.sender);

        // Always emit — gives no signal about membership status.
        emit GatedActionCalled(msg.sender);
    }
}
