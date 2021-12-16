// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Interface to the RandomWalkNFT contract.
abstract contract IRandomWalkNFT is IERC721 {
    uint256 public nextTokenId;
    mapping(uint256 => bytes32) public seeds;

    function mint() public virtual payable;
    function withdraw() public virtual;

    function getMintPrice() public virtual view returns (uint256);
}

// Interface to IMPISHDAO
abstract contract IImpishDAO is IERC20 {
    function deposit() public virtual payable;
}

contract ImpishSpiral is ERC721, ERC721Enumerable, Ownable, ReentrancyGuard {
    // Next TokenID
    uint256 private _tokenIdCounter;

    // When the last token was minted
    uint256 public lastMintTime;

    // Next mint price. Starts at 0.005 ETH
    uint256 public price = 0.005 ether;

    // No mints after this much time will result in the end of the mints
    uint256 constant public MINT_EXPIRY_TIME = 3 * 24 * 3600; // 3 days

    // Address of the RandomWalkNFT contract
    IRandomWalkNFT public _rwNFT;

    // Address of ImpishDAO
    IImpishDAO public _impishDAO;

    // The RNG seed that generates the spiral artwork
    // tokenId => seed
    mapping(uint256 => bytes32) public spiralSeeds;

    // Keep track of minted RandomWalkNFTs to prevent duplicate mints
    // RandomWalk tokenId => true if minted
    mapping(uint256 => bool) public mintedRWs;

    // Entropy
    bytes32 public entropy;

    // If the sale has started
    bool public started = false;

    // Keep track of the total rewards available
    uint256 public totalReward = 0;

    // List of all winners that have claimed their prize
    // tokenId -> true if winnings have been claimed
    mapping(uint256 => bool) public winningsClaimed;

    // The length of each path
    // tokenID -> Length
    mapping(uint256 => uint256) public spiralLengths;

    // Address of the Spirals Episode 2 contract
    address public spiralBitsContract = address(0);

    constructor(address _rwNFTaddress, address _impishDAOaddress) ERC721("ImpishSpiral", "SPIRAL") {
        _rwNFT = IRandomWalkNFT(_rwNFTaddress);
        _impishDAO = IImpishDAO(_impishDAOaddress);
    }

    function startMints() public onlyOwner {
        require(!started, "CantStartTwice");

        lastMintTime = block.timestamp;
        started = true;
    }

    // Mint price increases 0.5% with every mint
    function getMintPrice() public view returns (uint256) {
        return (price * 1005) / 1000;
    }

    function _mintSpiral(bytes32 seed) internal {
        require(started, "NotYetStarted");
        require(block.timestamp < (lastMintTime + MINT_EXPIRY_TIME), "MintsFinished");

        uint256 nextMintPrice = getMintPrice();
        require(msg.value >= nextMintPrice, "NotEnoughETH");

        // Keep track of the total reward money
        totalReward += nextMintPrice;

        uint256 excessETH = 0;
        if (msg.value > nextMintPrice) {
            excessETH = nextMintPrice - msg.value;
        }

        // Increase the mint price
        price = nextMintPrice;

        // Increment TokenId
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter +=1 ;

        // Save the seed for the RNG
        spiralSeeds[tokenId] = seed;

        // Set the last mint time.
        lastMintTime = block.timestamp;

        // Send any excess money back
        (bool success, ) = msg.sender.call{value: excessETH}("");
        require(success, "Transfer failed.");

        // And actually mint
        _safeMint(msg.sender, tokenId);
    }

    // Mint a spiral based on a RandomWalkNFT
    function mintSpiralWithRWNFT(uint256 _rwnftTokenId) public payable nonReentrant {
        require(_rwNFT.ownerOf(_rwnftTokenId) == msg.sender, "MinterDoesntOwnToken");
        require(!mintedRWs[_rwnftTokenId], "AlreadyMinted");

        // Mark this RandomWalkNFT as already minted.
        mintedRWs[_rwnftTokenId] = true;

        // Since we're minting based on RW, use the same seed
        _mintSpiral(_rwNFT.seeds(_rwnftTokenId));
        
        // The equivalent of 33% of the ETH is used to mint IMPISH tokens.
        uint256 impishDAOETH = (msg.value * 33) / 100;
        _impishDAO.deposit{value: impishDAOETH}();       

        // And send the impish tokens to the caller. 
        _impishDAO.transfer(msg.sender, _impishDAO.balanceOf(address(this)));
    }

    // Mint a random Spiral
    function mintSpiralRandom() public payable nonReentrant {
        entropy = keccak256(abi.encode(
            block.timestamp,
            blockhash(block.number),
            msg.sender,
            price,
            entropy));
        
        _mintSpiral(entropy);
    }

    // Claim winnings 
    function claimWin(uint256 tokenId) public nonReentrant {
        require(started, "NotYetStarted");
        require(block.timestamp > (lastMintTime + MINT_EXPIRY_TIME), "MintsStillOpen");
        require(tokenId < _tokenIdCounter, "TokenIDOutofRange");
        require(!winningsClaimed[tokenId], "AlreadyClaimed");

        // Make sure that this tokenId has actually won
        uint256 winningTokensAreGTE = 0;
        if (_tokenIdCounter > 10) {
            winningTokensAreGTE = _tokenIdCounter - 10;
        }
        require(tokenId >= winningTokensAreGTE, "TokenDidnotWin");

        // 1st place wins 10%, 2nd place 9%.... 10th place wins 1%
        uint256 winningPercent =  tokenId - winningTokensAreGTE + 1;
        uint256 winnings = (totalReward * winningPercent) / 100;

        // Mark winnings as claimed
        winningsClaimed[tokenId] = true;

        // Send the winnings to owner of the TokenID (Not the minter)
        address winnerAddress = ownerOf(tokenId);
        
        // Transfer winnings
        (bool success, ) = winnerAddress.call{value: winnings}("");
        require(success, "Transfer failed.");
    }

    function afterAllWinnings() public onlyOwner nonReentrant{
        require(started, "NotYetStarted");
        require(address(this).balance > 0, "Empty");
        require(block.timestamp > (lastMintTime + MINT_EXPIRY_TIME), "MintsStillOpen");

        uint256 winningTokensAreGTE = 0;
        if (_tokenIdCounter > 10) {
            winningTokensAreGTE = _tokenIdCounter - 10;
        }

        uint256 tid;
        for (tid = winningTokensAreGTE; tid < _tokenIdCounter; tid++) {
            require(winningsClaimed[tid], "WinningsNotYetClaimed");
        }

        // Transfer winnings
        (bool success, ) = owner().call{value: address(this).balance}("");
        require(success, "Transfer failed.");
    }

    // Returns a list of token Ids owned by _owner.
    function walletOfOwner(address _owner) public view
        returns (uint256[] memory) {
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

    // Set the lengths for the spirals
    function setSpiralLengths(uint256[] calldata tokenIDs, uint256[] calldata lengths) external onlyOwner {
        require(tokenIDs.length == lengths.length, "BadCall");

        // Set the lengths
        for (uint i=0; i < tokenIDs.length; i++) {
            spiralLengths[tokenIDs[i]] = lengths[i];
        }
    }

    function setSpiralBitsContract(address _bitsContract) external onlyOwner {
        spiralBitsContract = _bitsContract;
    }

    // Increase length of a spiral
    function removeLengthFromSpiral(uint256 tokenId, uint256 trimLength) external {
        require(msg.sender == spiralBitsContract, "YouCantCall");
        require(spiralLengths[tokenId] > 0, "NoTokenID");
        // Solidity 0.8.0 does the underflow check here automatically
        require(spiralLengths[tokenId] - trimLength > 400000, "CantTrimAnyMore");

        spiralLengths[tokenId] = spiralLengths[tokenId] - trimLength;
    }

    // Decrease length of a spiral
    function addLengthToSpiral(uint256 tokenId, uint256 addLength) external {
        require(msg.sender == spiralBitsContract, "YouCantCall");
        require(spiralLengths[tokenId] > 0, "NoTokenID");
        // Solidity 0.8.0 does the overflow check here automatically
        require(spiralLengths[tokenId] + addLength < 5000000, "CantAddAnyMore");

        spiralLengths[tokenId] = spiralLengths[tokenId] + addLength;
    }

    // The following functions are overrides required by Solidity.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId);
    }
}
