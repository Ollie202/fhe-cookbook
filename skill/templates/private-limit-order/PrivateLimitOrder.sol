// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title PrivateLimitOrder — match one buyer & one seller at hidden prices
/// @notice Buyer posts an encrypted max bid; seller posts an encrypted min ask.
///         If bid >= ask, the trade fills at the seller's ask price (revealed).
///         Otherwise both prices stay encrypted forever.
/// @dev Only the matched price is exposed; non-matching orders preserve full
///      price privacy.
contract PrivateLimitOrder is ZamaEthereumConfig {
    address public immutable buyer;
    address public immutable seller;

    euint64 private _bid;
    euint64 private _ask;
    bool public bidPosted;
    bool public askPosted;
    bool public matched;

    event BidPosted();
    event AskPosted();
    event Matched();

    constructor(address _seller) {
        buyer = msg.sender;
        seller = _seller;
    }

    function postBid(externalEuint64 encBid, bytes calldata proof) external {
        require(msg.sender == buyer, "not buyer");
        require(!bidPosted, "bid posted");
        _bid = FHE.fromExternal(encBid, proof);
        FHE.allowThis(_bid);
        bidPosted = true;
        emit BidPosted();
    }

    function postAsk(externalEuint64 encAsk, bytes calldata proof) external {
        require(msg.sender == seller, "not seller");
        require(!askPosted, "ask posted");
        _ask = FHE.fromExternal(encAsk, proof);
        FHE.allowThis(_ask);
        askPosted = true;
        emit AskPosted();
    }

    function attemptMatch() external {
        require(bidPosted && askPosted, "incomplete");
        require(!matched, "already matched");
        matched = true;

        ebool fills = FHE.ge(_bid, _ask);
        euint64 priceIfMatch = FHE.select(fills, _ask, FHE.asEuint64(0));

        FHE.allowThis(priceIfMatch);
        FHE.makePubliclyDecryptable(priceIfMatch);
        FHE.allowThis(fills);
        FHE.makePubliclyDecryptable(fills);

        emit Matched();
    }
}
