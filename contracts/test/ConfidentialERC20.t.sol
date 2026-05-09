// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {FhevmTest} from "forge-fhevm/FhevmTest.sol";
import {ConfidentialERC20} from "../src/ConfidentialERC20.sol";
import {externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";

contract ConfidentialERC20Test is FhevmTest {
    ConfidentialERC20 token;

    address minter;
    uint256 minterPk = 0xA11CE;
    address alice;
    uint256 alicePk = 0xBEEF;
    address bob;
    uint256 bobPk = 0xCAFE;

    function setUp() public override {
        super.setUp();
        minter = vm.addr(minterPk);
        alice  = vm.addr(alicePk);
        bob    = vm.addr(bobPk);

        vm.prank(minter);
        token = new ConfidentialERC20("Confidential USD", "cUSD");
    }

    function test_MintAndBalance() public {
        (externalEuint64 enc, bytes memory proof) =
            encryptUint64(1_000, minter, address(token));

        vm.prank(minter);
        token.mint(alice, enc, proof);

        euint64 bal = token.balanceOf(alice);
        uint64 plain = userDecryptUint64(bal, alice, address(token), alicePk);
        assertEq(plain, 1_000, "mint should credit alice 1000");
    }

    function test_TransferMovesFullAmount() public {
        // mint 1000 to alice
        (externalEuint64 m, bytes memory mp) = encryptUint64(1_000, minter, address(token));
        vm.prank(minter);
        token.mint(alice, m, mp);

        // alice transfers 400 to bob
        (externalEuint64 t, bytes memory tp) = encryptUint64(400, alice, address(token));
        vm.prank(alice);
        token.transfer(bob, t, tp);

        uint64 aliceBal = userDecryptUint64(token.balanceOf(alice), alice, address(token), alicePk);
        uint64 bobBal   = userDecryptUint64(token.balanceOf(bob),   bob,   address(token), bobPk);
        assertEq(aliceBal, 600);
        assertEq(bobBal, 400);
    }

    function test_OverdraftSilentlyMovesZero() public {
        // mint 100 to alice
        (externalEuint64 m, bytes memory mp) = encryptUint64(100, minter, address(token));
        vm.prank(minter);
        token.mint(alice, m, mp);

        // alice attempts to send 999 — should clamp to 0 moved
        (externalEuint64 t, bytes memory tp) = encryptUint64(999, alice, address(token));
        vm.prank(alice);
        token.transfer(bob, t, tp);

        uint64 aliceBal = userDecryptUint64(token.balanceOf(alice), alice, address(token), alicePk);
        uint64 bobBal   = userDecryptUint64(token.balanceOf(bob),   bob,   address(token), bobPk);
        assertEq(aliceBal, 100, "alice unchanged");
        assertEq(bobBal,   0,   "bob received 0");
    }

    function test_OnlyMinterCanMint() public {
        (externalEuint64 enc, bytes memory proof) = encryptUint64(1, alice, address(token));
        vm.prank(alice);
        vm.expectRevert(bytes("not minter"));
        token.mint(alice, enc, proof);
    }
}
