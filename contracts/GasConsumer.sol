// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract GasConsumer {

    uint256 public state;

    /**
     * Perform gas consuming operation that depends on iterations parameter
     *
     * @param iterations - number of iterations to perform
     */
    function compute(uint256 iterations) public {
        for (uint256 i=0; i<iterations; i++) {
            state = i;
        }
    }
}
