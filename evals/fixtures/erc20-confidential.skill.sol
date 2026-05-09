// Output produced by an agent WITH zama-cookbook loaded.
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract CToken is ZamaEthereumConfig {
    address public immutable minter;
    mapping(address => euint64) private _balance;

    constructor() { minter = msg.sender; }

    function balanceOf(address u) external view returns (euint64) { return _balance[u]; }

    function mint(address to, externalEuint64 e, bytes calldata p) external {
        require(msg.sender == minter, "not minter");
        euint64 amt = FHE.fromExternal(e, p);
        _balance[to] = FHE.add(_balance[to], amt);
        FHE.allowThis(_balance[to]);
        FHE.allow(_balance[to], to);
    }

    function transfer(address to, externalEuint64 e, bytes calldata p) external returns (euint64 moved) {
        euint64 want = FHE.fromExternal(e, p);
        ebool ok = FHE.le(want, _balance[msg.sender]);
        moved = FHE.select(ok, want, FHE.asEuint64(0));
        _balance[msg.sender] = FHE.sub(_balance[msg.sender], moved);
        _balance[to] = FHE.add(_balance[to], moved);
        FHE.allowThis(_balance[msg.sender]);
        FHE.allowThis(_balance[to]);
        FHE.allow(_balance[msg.sender], msg.sender);
        FHE.allow(_balance[to], to);
        FHE.allowThis(moved);
        FHE.allow(moved, msg.sender);
    }
}
