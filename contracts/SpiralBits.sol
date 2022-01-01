// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SpiralBits is ERC20, ERC20Burnable, Ownable {
    constructor() ERC20("SpiralBits", "SPIRALBITS") {}

    // List of allowed contracts allowed to stake
    mapping (address => bool) public allowedMinters;

    uint256 public constant MAX_SUPPLY = 100_000_000 * 10^18;

    function addAllowedMinter(address _minter) external onlyOwner {
        allowedMinters[_minter] = true;
    }

    function deleteAllowedMinter(address _minter) external onlyOwner {
        delete allowedMinters[_minter];
    }

    function mintSpiralBits(address to, uint256 amount) external onlyOwner {
        require(allowedMinters[msg.sender], "NotAllowed");
        require(totalSupply() + amount < MAX_SUPPLY, "WouldExceedMax");

        _mint(to, amount);
    }

    // Anybody can burn any amount of SpiralBits as long as they own it
    function burnSpiralBits(uint256 amount) external {
        require(balanceOf(msg.sender) >= amount, "NotEnough");

        _burn(msg.sender, amount);
    }
}
