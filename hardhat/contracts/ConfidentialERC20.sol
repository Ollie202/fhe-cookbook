// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ConfidentialERC20 — minimal confidential token (educational)
/// @notice Encrypted balances; transfers reveal nothing about amounts.
///         Uses the silent-clamp pattern (AP-012-aware): under-balance transfers
///         move 0 instead of reverting, and the actual moved amount is returned.
/// @dev For production, prefer @openzeppelin/confidential-contracts (ERC-7984).
contract ConfidentialERC20 is ZamaEthereumConfig {
    string public name;
    string public symbol;
    uint8 public constant decimals = 6;

    address public immutable minter;
    mapping(address => euint64) private _balance;

    event Transfer(address indexed from, address indexed to);
    event Mint(address indexed to);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        minter = msg.sender;
    }

    function balanceOf(address user) external view returns (euint64) {
        return _balance[user];
    }

    /// @notice Mint encrypted amount to `to`. Only the minter.
    function mint(address to, externalEuint64 encAmount, bytes calldata inputProof) external {
        require(msg.sender == minter, "not minter");
        euint64 amount = FHE.fromExternal(encAmount, inputProof);
        _balance[to] = FHE.add(_balance[to], amount);
        FHE.allowThis(_balance[to]);
        FHE.allow(_balance[to], to);
        emit Mint(to);
    }

    /// @notice Transfer encrypted amount. Returns the actual amount moved
    ///         (0 if sender lacked balance). Caller can decrypt to detect.
    function transfer(
        address to,
        externalEuint64 encAmount,
        bytes calldata inputProof
    ) external returns (euint64 moved) {
        euint64 requested = FHE.fromExternal(encAmount, inputProof);
        moved = _move(msg.sender, to, requested);
        emit Transfer(msg.sender, to);
    }

    function _move(address from, address to, euint64 requested) internal returns (euint64 moved) {
        ebool enough = FHE.le(requested, _balance[from]);
        moved = FHE.select(enough, requested, FHE.asEuint64(0));

        _balance[from] = FHE.sub(_balance[from], moved);
        _balance[to]   = FHE.add(_balance[to],   moved);

        FHE.allowThis(_balance[from]);
        FHE.allowThis(_balance[to]);
        FHE.allow(_balance[from], from);
        FHE.allow(_balance[to], to);

        FHE.allowThis(moved);
        FHE.allow(moved, from); // sender can decrypt actual moved amount
    }
}
