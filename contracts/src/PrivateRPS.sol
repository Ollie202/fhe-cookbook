// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint8, ebool, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title PrivateRPS — two-player rock/paper/scissors with sealed moves
/// @notice Each player submits an encrypted move (0=rock, 1=paper, 2=scissors).
///         When both have committed, anyone calls `resolve()` to reveal the
///         winner — the moves themselves stay encrypted forever.
/// @dev Showcases encrypted-only resolution. Result encoding: 0=tie, 1=A wins, 2=B wins.
contract PrivateRPS is ZamaEthereumConfig {
    address public immutable playerA;
    address public immutable playerB;

    euint8 private _moveA;
    euint8 private _moveB;
    bool public hasA;
    bool public hasB;
    bool public resolved;
    euint8 private _result;

    event Committed(address indexed who);
    event Resolved();

    constructor(address _b) {
        playerA = msg.sender;
        playerB = _b;
    }

    function commit(externalEuint8 encMove, bytes calldata inputProof) external {
        require(msg.sender == playerA || msg.sender == playerB, "not a player");
        require(!resolved, "resolved");
        euint8 m = FHE.fromExternal(encMove, inputProof);
        if (msg.sender == playerA) {
            require(!hasA, "A already committed");
            _moveA = m;
            FHE.allowThis(_moveA);
            hasA = true;
        } else {
            require(!hasB, "B already committed");
            _moveB = m;
            FHE.allowThis(_moveB);
            hasB = true;
        }
        emit Committed(msg.sender);
    }

    function resolve() external {
        require(hasA && hasB, "both must commit");
        require(!resolved, "resolved");
        resolved = true;

        ebool tie = FHE.eq(_moveA, _moveB);
        // A wins iff (moveA + 3 - moveB) mod 3 == 1.  Steps split out so the
        // FHE.rem divisor is unambiguously a plaintext uint8(3).
        euint8 three = FHE.asEuint8(3);
        euint8 aPlusThree = FHE.add(_moveA, three);
        euint8 threeMinusB = FHE.sub(three, _moveB);
        euint8 totalSum = FHE.add(aPlusThree, threeMinusB);
        euint8 diff = FHE.rem(totalSum, uint8(3));
        ebool aWins = FHE.eq(diff, FHE.asEuint8(1));

        euint8 res = FHE.select(aWins, FHE.asEuint8(1), FHE.asEuint8(2));
        _result = FHE.select(tie, FHE.asEuint8(0), res);

        FHE.allowThis(_result);
        FHE.makePubliclyDecryptable(_result);
        emit Resolved();
    }

    function result() external view returns (euint8) { return _result; }
}
