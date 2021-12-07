// SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

pragma solidity ^0.8.9;

contract RandomWalkNFT is ERC721Enumerable, Ownable {

    uint256 public saleTime = 1636675200; // November 11 2021 19:00 New York Time
    uint256 public price = 10**15; // Price starts at .001 eth

    // How long to wait until the last minter can withdraw
    uint256 public withdrawalWaitSeconds = 3600 * 24 * 30; // 1 month

    // Seeds
    mapping(uint256 => bytes32) public seeds;

    mapping(uint256 => string) public tokenNames;

    uint256 public numWithdrawals = 0;
    mapping(uint256 => uint256) public withdrawalNums;
    mapping(uint256 => uint256) public withdrawalAmounts;

    // Entropy
    bytes32 public entropy;

    address public lastMinter = address(0);
    uint256 public lastMintTime = saleTime;
    uint256 public nextTokenId = 0;

    string private _baseTokenURI;

    event TokenNameEvent(uint256 tokenId, string newName);
    event MintEvent(uint256 indexed tokenId, address indexed owner, bytes32 seed, uint256 price);
    event WithdrawalEvent(uint256 indexed tokenId, address destination, uint256 amount);

    // IPFS link to the Python script that generates images and videos for each NFT based on seed.
    string public tokenGenerationScript = "ipfs://QmP7Z8VbQLpytzXnceeAAc4D5tX39XVzoEeUZwEK8aPk8W";

    constructor() ERC721("RandomWalkNFT", "RWLK") {
        entropy = keccak256(abi.encode(
            "A two-dimensional random walk will return to the point where it started, but a three-dimensional one may not.",
            block.timestamp, blockhash(block.number)));
    }

    function setBaseURI(string memory baseURI) public onlyOwner {
        _baseTokenURI = baseURI;
    }

    function setTokenName(uint256 tokenId, string memory name) public {
        require(
            _isApprovedOrOwner(_msgSender(), tokenId),
            "setTokenName caller is not owner nor approved"
        );
        require(bytes(name).length <= 32, "Token name is too long.");
        tokenNames[tokenId] = name;
        emit TokenNameEvent(tokenId, name);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    function getMintPrice() public view returns (uint256) {
        return (price * 10011) / 10000;
    }

    function timeUntilSale() public view returns (uint256) {
        if (saleTime < block.timestamp) return 0;
        return saleTime - block.timestamp;
    }

    function timeUntilWithdrawal() public view returns (uint256) {
        uint256 withdrawalTime = lastMintTime + withdrawalWaitSeconds;
        if (withdrawalTime < block.timestamp) return 0;
        return withdrawalTime - block.timestamp;
    }

    function withdrawalAmount() public view returns (uint256) {
        return address(this).balance / 2;
    }

    /**
     * If there was no mint for withdrawalWaitSeconds, then the last minter can withdraw
     * half of the balance in the smart contract.
     */
    function withdraw() public {
        require(_msgSender() == lastMinter, "Only last minter can withdraw.");
        require(timeUntilWithdrawal() == 0, "Not enough time has elapsed.");

        address destination = lastMinter;
        // Someone will need to mint again to become the last minter.
        lastMinter = address(0);

        // Token that trigerred the withdrawal
        uint256 tokenId = nextTokenId - 1;
        uint256 amount = withdrawalAmount();

        numWithdrawals += 1;
        withdrawalNums[tokenId] = numWithdrawals;
        withdrawalAmounts[tokenId] = amount;

        // Transfer half of the balance to the last minter.
        (bool success, ) = destination.call{value: amount}("");
        require(success, "Transfer failed.");

        emit WithdrawalEvent(tokenId, destination, amount);
    }

    function mint() public payable {
        uint256 newPrice = getMintPrice();
        require(
            msg.value >= newPrice,
            "The value submitted with this transaction is too low."
        );
        require(
            block.timestamp >= saleTime,
            "The sale is not open yet."
        );

        lastMinter = _msgSender();
        lastMintTime = block.timestamp;

        price = newPrice;
        uint256 tokenId = nextTokenId;
        nextTokenId += 1;

        entropy = keccak256(abi.encode(
            entropy,
            block.timestamp,
            blockhash(block.number),
            tokenId,
            lastMinter));
        seeds[tokenId] = entropy;
        _safeMint(lastMinter, tokenId);

        if (msg.value > price) {
            // Return the extra money to the minter.
            (bool success, ) = lastMinter.call{value: msg.value - price}("");
            require(success, "Transfer failed.");
        }

        emit MintEvent(tokenId, lastMinter, entropy, price);
    }

    // Returns a list of token Ids owned by _owner.
    function walletOfOwner(address _owner)
        public
        view
        returns (uint256[] memory)
    {
        uint256 tokenCount = balanceOf(_owner);

        if (tokenCount == 0) {
            // Return an empty array
            return new uint256[](0);
        }

        uint256[] memory result = new uint256[](tokenCount);
        for (uint256 i; i < tokenCount; i++) {
            result[i] = tokenOfOwnerByIndex(_owner, i);
        }
        return result;
    }

    // Returns a list of seeds owned by _owner.
    function seedsOfOwner(address _owner)
        public
        view
        returns (bytes32[] memory)
    {
        uint256 tokenCount = balanceOf(_owner);

        if (tokenCount == 0) {
            // Return an empty array
            return new bytes32[](0);
        }

        bytes32[] memory result = new bytes32[](tokenCount);
        for (uint256 i; i < tokenCount; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(_owner, i);
            result[i] = seeds[tokenId];
        }
        return result;
    }
}
