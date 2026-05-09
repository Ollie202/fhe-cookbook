// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ConfidentialVesting — encrypted total, linear time-based unlock
/// @notice Beneficiary's total grant is encrypted; the unlocked fraction is
///         computed as `(encryptedTotal / (duration / elapsed))` using plaintext
///         divisors. Outsiders learn the timeline but never the amount.
contract ConfidentialVesting is ZamaEthereumConfig {
    address public immutable grantor;
    address public immutable beneficiary;
    uint256 public immutable start;
    uint256 public immutable duration;

    euint64 private _total;
    euint64 private _claimed;

    event Funded();
    event Claimed();

    constructor(address _beneficiary, uint256 _durationSeconds) {
        grantor = msg.sender;
        beneficiary = _beneficiary;
        start = block.timestamp;
        duration = _durationSeconds;
    }

    function fund(externalEuint64 encTotal, bytes calldata inputProof) external {
        require(msg.sender == grantor, "not grantor");
        require(!FHE.isInitialized(_total), "already funded");
        _total = FHE.fromExternal(encTotal, inputProof);
        _claimed = FHE.asEuint64(0);
        FHE.allowThis(_total);
        FHE.allowThis(_claimed);
        FHE.allow(_total, beneficiary);
        emit Funded();
    }

    function claim() external {
        require(msg.sender == beneficiary, "not beneficiary");
        require(FHE.isInitialized(_total), "not funded");

        uint256 elapsed = block.timestamp - start;
        if (elapsed > duration) elapsed = duration;

        euint64 unlocked;
        if (elapsed == duration) {
            unlocked = _total;
            FHE.allowThis(unlocked);
        } else if (elapsed == 0) {
            unlocked = FHE.asEuint64(0);
            FHE.allowThis(unlocked);
        } else {
            unlocked = FHE.div(_total, uint64(duration / elapsed));
            FHE.allowThis(unlocked);
        }

        _claimed = unlocked;
        FHE.allowThis(_claimed);
        FHE.allow(_claimed, beneficiary);
        emit Claimed();
    }

    function totalGrant() external view returns (euint64) { return _total; }
    function claimedAmount() external view returns (euint64) { return _claimed; }
}
