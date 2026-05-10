// Output produced by an agent WITHOUT fhe-cookbook.
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

// Imagined OpenZeppelin import — wrong shape, no FHE awareness.
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CToken is ERC20 {
    constructor() ERC20("Confidential", "cUSD") {}
    // Agent had no idea how to make balances private — defaulted to plain ERC-20.
}
