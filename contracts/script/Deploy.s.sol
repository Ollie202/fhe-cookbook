// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";
import {ConfidentialERC20} from "../src/ConfidentialERC20.sol";
import {SealedBidAuction} from "../src/SealedBidAuction.sol";
import {PrivateVote} from "../src/PrivateVote.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        ConfidentialERC20 token = new ConfidentialERC20("Confidential USD", "cUSD");
        SealedBidAuction auction = new SealedBidAuction("Vintage 1985 Macintosh", 1 days);
        PrivateVote vote = new PrivateVote(3, 1 days);

        console2.log("ConfidentialERC20", address(token));
        console2.log("SealedBidAuction", address(auction));
        console2.log("PrivateVote", address(vote));

        vm.stopBroadcast();
    }
}
