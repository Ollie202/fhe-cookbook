// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title EncryptedDice — fair 6-sided die rolls with on-chain FHE randomness
/// @notice Anyone can call `roll()` to get a fresh encrypted dice value 1..6.
///         The roll is decryptable only by the caller.
/// @dev Showcases `FHE.randEuint8` + plaintext-divisor `FHE.rem`.
contract EncryptedDice is ZamaEthereumConfig {
    mapping(address => euint8) private _lastRoll;
    mapping(address => uint256) public rollCount;

    event Rolled(address indexed who, uint256 nthRoll);

    function roll() external {
        euint8 r = FHE.randEuint8();
        euint8 mod6 = FHE.rem(r, uint8(6));
        euint8 oneToSix = FHE.add(mod6, FHE.asEuint8(1));
        _lastRoll[msg.sender] = oneToSix;
        FHE.allowThis(oneToSix);
        FHE.allow(oneToSix, msg.sender);
        rollCount[msg.sender]++;
        emit Rolled(msg.sender, rollCount[msg.sender]);
    }

    function lastRoll(address who) external view returns (euint8) {
        return _lastRoll[who];
    }
}
