// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CxsBurner {
    event CxsReceived(address indexed from, uint256 amount);
    event CxsBurned(uint256 amount);

    receive() external payable {
        emit CxsReceived(msg.sender, msg.value);
        // Brûler les CXS en les envoyant à l'adresse 0x000000000000000000000000000000000000dEaD
        (bool success, ) = address(0x000000000000000000000000000000000000dEaD).call{value: msg.value}("");
        require(success, "Burn failed");
        emit CxsBurned(msg.value);
    }
} 