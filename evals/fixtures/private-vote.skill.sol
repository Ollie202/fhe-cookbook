// Output produced by an agent WITH zama-cookbook loaded.
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint8, euint32, ebool, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract Vote is ZamaEthereumConfig {
    uint8 public immutable OPTIONS;
    uint256 public immutable deadline;
    mapping(address => bool) public voted;
    euint32[] private _tally;
    bool public revealed;

    constructor(uint8 o, uint256 d) {
        OPTIONS = o;
        deadline = block.timestamp + d;
        for (uint8 i = 0; i < o; i++) {
            euint32 z = FHE.asEuint32(0);
            _tally.push(z);
            FHE.allowThis(z);
        }
    }

    function vote(externalEuint8 e, bytes calldata p) external {
        require(block.timestamp < deadline && !voted[msg.sender], "no");
        voted[msg.sender] = true;
        euint8 c = FHE.fromExternal(e, p);
        for (uint8 i = 0; i < OPTIONS; i++) {
            ebool m = FHE.eq(c, FHE.asEuint8(i));
            euint32 inc = FHE.select(m, FHE.asEuint32(1), FHE.asEuint32(0));
            _tally[i] = FHE.add(_tally[i], inc);
            FHE.allowThis(_tally[i]);
        }
    }

    function tallyOf(uint8 i) external view returns (euint32) { return _tally[i]; }

    function reveal() external {
        require(block.timestamp >= deadline && !revealed, "no");
        revealed = true;
        for (uint8 i = 0; i < OPTIONS; i++) FHE.makePubliclyDecryptable(_tally[i]);
    }
}
