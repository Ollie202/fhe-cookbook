// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint32, eaddress, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title BlindLottery — random winner from a fixed pool of entrants
/// @notice Anyone can enter while the lottery is open. After the deadline,
///         anyone may draw: the contract picks a winner using on-coprocessor
///         randomness (`FHE.randEuint32`), then makes the winner index +
///         winner address publicly decryptable.
/// @dev Showcases `FHE.randEuint*` (encrypted random — no VRF needed) and
///      branchless selection over an array of entrants.
contract BlindLottery is ZamaEthereumConfig {
    address public immutable host;
    uint256 public immutable deadline;
    uint256 public immutable maxEntrants;

    address[] private _entrants;
    mapping(address => bool) public hasEntered;

    bool public drawn;
    euint32  private _winnerIndex;
    eaddress private _winnerAddress;

    event Entered(address indexed who, uint256 index);
    event Drawn();

    constructor(uint256 _durationSeconds, uint256 _maxEntrants) {
        host = msg.sender;
        deadline = block.timestamp + _durationSeconds;
        maxEntrants = _maxEntrants;
    }

    function entrantCount() external view returns (uint256) {
        return _entrants.length;
    }

    /// @notice Buy a ticket — one per address, free in this template.
    function enter() external {
        require(block.timestamp < deadline, "lottery closed");
        require(!hasEntered[msg.sender], "already entered");
        require(_entrants.length < maxEntrants, "full");
        hasEntered[msg.sender] = true;
        _entrants.push(msg.sender);
        emit Entered(msg.sender, _entrants.length - 1);
    }

    /// @notice After the deadline, draw a random winner from the entrants.
    ///         The random index and the corresponding address are encrypted
    ///         on-chain and made publicly decryptable.
    function draw() external {
        require(block.timestamp >= deadline, "lottery running");
        require(!drawn, "already drawn");
        require(_entrants.length > 0, "no entrants");
        drawn = true;

        // 1) Pull a fresh encrypted random uint32. Reduce mod n via plaintext divisor.
        euint32 r = FHE.randEuint32();
        euint32 idx = FHE.rem(r, uint32(_entrants.length));
        _winnerIndex = idx;

        // 2) Branchlessly select the winner address from the array.
        //    Equivalent to: _winnerAddress = entrants[idx]
        _winnerAddress = FHE.asEaddress(address(0));
        for (uint32 i = 0; i < uint32(_entrants.length); i++) {
            ebool match_ = FHE.eq(idx, FHE.asEuint32(i));
            _winnerAddress = FHE.select(match_, FHE.asEaddress(_entrants[i]), _winnerAddress);
            FHE.allowThis(_winnerAddress);
        }

        // 3) Reveal both publicly.
        FHE.allowThis(_winnerIndex);
        FHE.allowThis(_winnerAddress);
        FHE.makePubliclyDecryptable(_winnerIndex);
        FHE.makePubliclyDecryptable(_winnerAddress);

        emit Drawn();
    }

    function winnerIndex() external view returns (euint32) { return _winnerIndex; }
    function winnerAddress() external view returns (eaddress) { return _winnerAddress; }
}
