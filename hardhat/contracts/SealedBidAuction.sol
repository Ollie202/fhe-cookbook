// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, eaddress, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SealedBidAuction — first-price sealed-bid auction over encrypted bids
/// @notice Bidders submit encrypted bids during the bidding window. After the
///         deadline, anyone may settle: the contract makes the highest bid +
///         winner publicly decryptable so the frontend (or any observer) can
///         decrypt them off-chain via the relayer.
/// @dev Demonstrates branchless `FHE.select` (AP-001), proper ACL pattern,
///      and `makePubliclyDecryptable` for post-deadline reveal.
contract SealedBidAuction is ZamaEthereumConfig {
    address public immutable seller;
    uint256 public immutable deadline;
    string  public itemDescription;

    euint64  private _highestBid;
    eaddress private _highestBidder;

    bool public settled;

    event BidPlaced(address indexed bidder);
    event Settled();

    constructor(string memory _item, uint256 _durationSeconds) {
        seller = msg.sender;
        itemDescription = _item;
        deadline = block.timestamp + _durationSeconds;

        _highestBid    = FHE.asEuint64(0);
        _highestBidder = FHE.asEaddress(address(0));
        FHE.allowThis(_highestBid);
        FHE.allowThis(_highestBidder);
    }

    /// @notice Submit a sealed bid. Replaces the running highest if strictly greater.
    function bid(externalEuint64 encBid, bytes calldata inputProof) external {
        require(block.timestamp < deadline, "auction closed");

        euint64 newBid = FHE.fromExternal(encBid, inputProof);

        ebool isHigher = FHE.gt(newBid, _highestBid);
        _highestBid    = FHE.select(isHigher, newBid, _highestBid);
        _highestBidder = FHE.select(
            isHigher,
            FHE.asEaddress(msg.sender),
            _highestBidder
        );

        FHE.allowThis(_highestBid);
        FHE.allowThis(_highestBidder);

        emit BidPlaced(msg.sender);
    }

    /// @notice After the deadline, anyone may trigger settlement.
    function settle() external {
        require(block.timestamp >= deadline, "auction running");
        require(!settled, "already settled");
        settled = true;

        // Reveal only the winning bid + winner; all losing bids stay encrypted.
        FHE.makePubliclyDecryptable(_highestBid);
        FHE.makePubliclyDecryptable(_highestBidder);

        emit Settled();
    }

    function highestBid() external view returns (euint64) { return _highestBid; }
    function highestBidder() external view returns (eaddress) { return _highestBidder; }
}
