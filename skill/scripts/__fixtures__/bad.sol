// SPDX-License-Identifier: MIT
// Deliberately broken contract — exercises every fhe-lint rule.
pragma solidity ^0.8.27;

import "fhevm/lib/TFHE.sol"; // STACK-001 + AP-016 — bare 'fhevm' + TFHE

contract Bad {                                    // STACK-002 — no Zama config
    mapping(address => externalEuint64) _staged;  // AP-005
    mapping(uint256 => bytes32[]) _handles;
    euint64 _bal;

    function bidBad(externalEuint64 e, bytes calldata inputProof) external {
        // AP-013 — proof forwarded to another contract without ingestion
        IOther(other).consume(e, inputProof);

        ebool flag = TFHE.gt(_bal, _bal);          // AP-016 + AP-001 setup
        if (flag) { _bal = _bal; }                 // AP-001 — branch on ebool
        if (TFHE.gt(_bal, _bal)) { revert(); }     // AP-001 again

        _bal = TFHE.add(_bal, _bal);               // AP-002 — no allowThis
        _bal = TFHE.div(_bal, _bal);               // AP-004 — encrypted divisor

        uint256 reqId = uint256(euint64.unwrap(_bal)); // AP-008
        _handles[reqId].push(bytes32(0));

        // AP-014
        address(0).delegatecall("");
    }

    // AP-006 + AP-007 — callback shape, no checkSignatures, no delete
    function onDecrypted(uint256 id, bytes memory cleartexts, bytes memory proof) public {
        uint64 plain = abi.decode(cleartexts, (uint64));
        _bal = TFHE.add(_bal, TFHE.asEuint64(plain));
    }

    // AP-015
    euint256 _huge;
}
