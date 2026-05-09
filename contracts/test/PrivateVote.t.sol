// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {FhevmTest} from "forge-fhevm/FhevmTest.sol";
import {PrivateVote} from "../src/PrivateVote.sol";
import {externalEuint8, euint32} from "@fhevm/solidity/lib/FHE.sol";

contract PrivateVoteTest is FhevmTest {
    PrivateVote vote;
    uint256 constant DURATION = 1 days;
    uint8 constant OPTIONS = 3;

    address admin = address(this);
    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave  = makeAddr("dave");

    function setUp() public override {
        super.setUp();
        vote = new PrivateVote(OPTIONS, DURATION);
        address[] memory voters = new address[](4);
        voters[0] = alice; voters[1] = bob; voters[2] = carol; voters[3] = dave;
        vote.setEligible(voters);
    }

    function _cast(address voter, uint8 choice) internal {
        (externalEuint8 enc, bytes memory proof) = encryptUint8(choice, voter, address(vote));
        vm.prank(voter);
        vote.vote(enc, proof);
    }

    function test_TallyAfterReveal() public {
        _cast(alice, 0);
        _cast(bob,   1);
        _cast(carol, 1);
        _cast(dave,  2);

        vm.warp(block.timestamp + DURATION + 1);
        vote.reveal();

        // After reveal, tallies are publicly decryptable
        uint32 t0 = publicDecryptUint32(vote.tallyOf(0));
        uint32 t1 = publicDecryptUint32(vote.tallyOf(1));
        uint32 t2 = publicDecryptUint32(vote.tallyOf(2));
        assertEq(t0, 1);
        assertEq(t1, 2);
        assertEq(t2, 1);
    }

    function test_NotEligibleReverts() public {
        address eve = makeAddr("eve");
        (externalEuint8 enc, bytes memory proof) = encryptUint8(0, eve, address(vote));
        vm.prank(eve);
        vm.expectRevert(bytes("not eligible"));
        vote.vote(enc, proof);
    }

    function test_DoubleVoteReverts() public {
        _cast(alice, 0);
        (externalEuint8 enc, bytes memory proof) = encryptUint8(1, alice, address(vote));
        vm.prank(alice);
        vm.expectRevert(bytes("already voted"));
        vote.vote(enc, proof);
    }

    function test_CannotVoteAfterDeadline() public {
        vm.warp(block.timestamp + DURATION + 1);
        (externalEuint8 enc, bytes memory proof) = encryptUint8(0, alice, address(vote));
        vm.prank(alice);
        vm.expectRevert(bytes("voting closed"));
        vote.vote(enc, proof);
    }
}
