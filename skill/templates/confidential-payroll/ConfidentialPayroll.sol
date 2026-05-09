// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ConfidentialPayroll — batch confidential salary deposits
/// @notice An employer credits each employee with an encrypted salary in a
///         single transaction. Each employee can decrypt only their own
///         balance; coworkers and the public see nothing.
/// @dev Showcases batched `FHE.fromExternal` ingestion sharing one input proof.
contract ConfidentialPayroll is ZamaEthereumConfig {
    address public immutable employer;
    mapping(address => euint64) private _balance;

    event Paid(address indexed employee);
    event Withdrawn(address indexed employee);

    constructor() { employer = msg.sender; }

    function balanceOf(address who) external view returns (euint64) {
        return _balance[who];
    }

    /// @notice Pay multiple employees in one tx. Each amount is encrypted;
    ///         all share a single input proof for gas savings.
    function payBatch(
        address[] calldata employees,
        externalEuint64[] calldata encAmounts,
        bytes calldata sharedProof
    ) external {
        require(msg.sender == employer, "not employer");
        require(employees.length == encAmounts.length, "length mismatch");
        for (uint256 i = 0; i < employees.length; i++) {
            euint64 amt = FHE.fromExternal(encAmounts[i], sharedProof);
            _balance[employees[i]] = FHE.add(_balance[employees[i]], amt);
            FHE.allowThis(_balance[employees[i]]);
            FHE.allow(_balance[employees[i]], employees[i]);
            emit Paid(employees[i]);
        }
    }

    function refreshAccess() external {
        FHE.allow(_balance[msg.sender], msg.sender);
        emit Withdrawn(msg.sender);
    }
}
