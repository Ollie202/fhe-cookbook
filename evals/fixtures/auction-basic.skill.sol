// Output produced by an agent WITH fhe-cookbook loaded.
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, eaddress, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract Auction is ZamaEthereumConfig {
    uint256 public immutable deadline;
    euint64 private _highestBid;
    eaddress private _highestBidder;
    bool public settled;
    uint64 public winningBid;
    address public winner;
    uint256 private _nextId;
    mapping(uint256 => bytes32[]) private _handles;

    constructor(uint256 d) {
        deadline = block.timestamp + d;
        _highestBid = FHE.asEuint64(0);
        _highestBidder = FHE.asEaddress(address(0));
        FHE.allowThis(_highestBid);
        FHE.allowThis(_highestBidder);
    }

    function bid(externalEuint64 enc, bytes calldata proof) external {
        require(block.timestamp < deadline, "closed");
        euint64 newBid = FHE.fromExternal(enc, proof);
        ebool higher = FHE.gt(newBid, _highestBid);
        _highestBid = FHE.select(higher, newBid, _highestBid);
        _highestBidder = FHE.select(higher, FHE.asEaddress(msg.sender), _highestBidder);
        FHE.allowThis(_highestBid);
        FHE.allowThis(_highestBidder);
    }

    function settle() external returns (uint256 reqId) {
        require(block.timestamp >= deadline && !settled, "no");
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = euint64.unwrap(_highestBid);
        cts[1] = eaddress.unwrap(_highestBidder);
        reqId = ++_nextId;
        _handles[reqId] = cts;
        FHE.requestDecryption(cts, this.onSettled.selector);
    }

    function onSettled(uint256 reqId, bytes memory cleartexts, bytes memory proof) public {
        bytes32[] memory cts = _handles[reqId];
        require(cts.length == 2, "unknown");
        FHE.checkSignatures(cts, cleartexts, proof);
        delete _handles[reqId];
        (uint64 b, address w) = abi.decode(cleartexts, (uint64, address));
        winningBid = b;
        winner = w;
        settled = true;
    }
}
