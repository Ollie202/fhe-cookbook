// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint8, euint32, ebool, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title PrivateVote — single-choice voting with encrypted ballots & tallies
/// @notice Each eligible voter submits one encrypted choice in [0, OPTIONS).
///         The contract maintains an encrypted running tally per option.
///         After the deadline, tallies are made publicly decryptable.
/// @dev Demonstrates fixed-width loop (privacy-safe), branchless update,
///      and one-shot public reveal.
contract PrivateVote is ZamaEthereumConfig {
    uint8 public immutable OPTIONS;
    uint256 public immutable deadline;
    address public immutable admin;

    mapping(address => bool) public hasVoted;
    mapping(address => bool) public isEligible;
    euint32[] private _tally;
    bool public revealed;

    event Eligible(address indexed voter);
    event Voted(address indexed voter);
    event Revealed();

    constructor(uint8 options, uint256 durationSeconds) {
        require(options >= 2 && options <= 16, "options out of range");
        OPTIONS = options;
        deadline = block.timestamp + durationSeconds;
        admin = msg.sender;
        for (uint8 i = 0; i < options; i++) {
            euint32 zero = FHE.asEuint32(0);
            _tally.push(zero);
            FHE.allowThis(zero);
        }
    }

    function setEligible(address[] calldata voters) external {
        require(msg.sender == admin, "not admin");
        for (uint256 i = 0; i < voters.length; i++) {
            isEligible[voters[i]] = true;
            emit Eligible(voters[i]);
        }
    }

    function vote(externalEuint8 encChoice, bytes calldata inputProof) external {
        require(block.timestamp < deadline, "voting closed");
        require(isEligible[msg.sender], "not eligible");
        require(!hasVoted[msg.sender], "already voted");
        hasVoted[msg.sender] = true;

        euint8 choice = FHE.fromExternal(encChoice, inputProof);

        // Fixed-width loop — privacy safe (always touches every option).
        // Each iteration adds 1 to the matching option, 0 elsewhere.
        for (uint8 i = 0; i < OPTIONS; i++) {
            ebool match_ = FHE.eq(choice, FHE.asEuint8(i));
            euint32 inc  = FHE.select(match_, FHE.asEuint32(1), FHE.asEuint32(0));
            _tally[i]    = FHE.add(_tally[i], inc);
            FHE.allowThis(_tally[i]);
        }
        emit Voted(msg.sender);
    }

    function tallyOf(uint8 option) external view returns (euint32) {
        return _tally[option];
    }

    /// @notice After the deadline, expose all tallies for public decryption.
    function reveal() external {
        require(block.timestamp >= deadline, "voting running");
        require(!revealed, "already revealed");
        revealed = true;
        for (uint8 i = 0; i < OPTIONS; i++) {
            FHE.makePubliclyDecryptable(_tally[i]);
        }
        emit Revealed();
    }
}
