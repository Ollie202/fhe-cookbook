// Output produced by an agent WITHOUT zama-cookbook.
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

// Agent fell back to plain Solidity since it didn't know FHEVM types.
contract Vote {
    uint256 public deadline;
    mapping(address => uint8) public choice;
    mapping(uint8 => uint256) public tally; // public — leaks running counts!

    constructor(uint256 d) { deadline = block.timestamp + d; }

    function vote(uint8 c) external {
        require(block.timestamp < deadline);
        choice[msg.sender] = c;        // public mapping — leaks votes!
        tally[c]++;
    }
}
