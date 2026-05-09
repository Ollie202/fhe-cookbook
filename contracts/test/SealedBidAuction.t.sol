// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {FhevmTest} from "forge-fhevm/FhevmTest.sol";
import {SealedBidAuction} from "../src/SealedBidAuction.sol";
import {externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

contract SealedBidAuctionTest is FhevmTest {
    SealedBidAuction auction;
    uint256 constant DURATION = 1 hours;

    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");
    address carol = makeAddr("carol");

    function setUp() public override {
        super.setUp();
        auction = new SealedBidAuction("Vintage 1985 Macintosh", DURATION);
    }

    function _bid(address who, uint64 amount) internal {
        (externalEuint64 enc, bytes memory proof) =
            encryptUint64(amount, who, address(auction));
        vm.prank(who);
        auction.bid(enc, proof);
    }

    function test_HighestBidWins() public {
        _bid(alice, 100);
        _bid(bob,   250);
        _bid(carol, 175);

        vm.warp(block.timestamp + DURATION + 1);
        auction.requestSettlement();
        // forge-fhevm auto-fulfils decryption requests in mock mode

        assertEq(auction.revealedWinner(), bob, "bob (highest bid) wins");
        assertEq(auction.revealedBid(), 250, "winning bid revealed");
        assertTrue(auction.settled());
    }

    function test_CannotBidAfterDeadline() public {
        vm.warp(block.timestamp + DURATION + 1);
        (externalEuint64 enc, bytes memory proof) = encryptUint64(500, alice, address(auction));
        vm.prank(alice);
        vm.expectRevert(bytes("auction closed"));
        auction.bid(enc, proof);
    }

    function test_CannotSettleBeforeDeadline() public {
        _bid(alice, 50);
        vm.expectRevert(bytes("auction running"));
        auction.requestSettlement();
    }

    function test_TiesGoToFirstBidder() public {
        _bid(alice, 100);
        _bid(bob,   100); // not strictly greater — alice should retain

        vm.warp(block.timestamp + DURATION + 1);
        auction.requestSettlement();
        assertEq(auction.revealedWinner(), alice);
        assertEq(auction.revealedBid(), 100);
    }
}
