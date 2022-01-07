// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

pragma abicoder v2;

// import "hardhat/console.sol";

import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

abstract contract IWETH9 {
    function deposit() external payable virtual;
    function withdraw(uint256 amount) external virtual;
    function balanceOf(address owner) external virtual returns (uint256);
}

abstract contract IImpishDAO {
    function buyNFTPrice(uint256 tokenID) public view virtual returns (uint256);
    function buyNFT(uint256 tokenID) public virtual;
}

abstract contract IRwNFTStaking {
    function stakeNFTsForOwner(uint32[] calldata tokenIds, address owner) public virtual;
}

contract BuyWithEther is IERC721Receiver {
    // Uniswap v3router
    ISwapRouter public immutable swapRouter;

    // Contract addresses deployed on Arbitrum
    address public constant WETH9 = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address public constant IMPISH = 0x36F6d831210109719D15abAEe45B327E9b43D6C6;
    address public constant RWNFT = 0x895a6F444BE4ba9d124F61DF736605792B35D66b;
    address public constant SPIRALBITS = 0x650A9960673688Ba924615a2D28c39A8E015fB19;
    address public constant RWNFTSTAKING = 0xD9403e7497051b317cf1aE88eEaf46ee4E8eAD68;

    // For this example, we will set the pool fee to 1%.
    uint24 public constant poolFee = 10000;

    constructor(ISwapRouter _swapRouter) {
        swapRouter = _swapRouter;

        // Approve the router to spend the WETH9
        TransferHelper.safeApprove(WETH9, address(swapRouter), 2**256 - 1);
        TransferHelper.safeApprove(SPIRALBITS, address(swapRouter), 2**256 - 1);

        IERC721(RWNFT).setApprovalForAll(RWNFTSTAKING, true);
    }

    function buyRwNFTFromDaoWithEth(uint256 tokenId, bool stake) external payable {
        // Get the buyNFT price
        uint256 nftPriceInIMPISH = IImpishDAO(IMPISH).buyNFTPrice(tokenId);
        swapExactOutputSingle(nftPriceInIMPISH, msg.value);

        IImpishDAO(IMPISH).buyNFT(tokenId);

        if (!stake) {
            // transfer the NFT to the sender
            IERC721(RWNFT).safeTransferFrom(address(this), msg.sender, tokenId);
        } else {
            uint32[] memory tokens  = new uint32[](1);
            tokens[0] = uint32(tokenId);
            IRwNFTStaking(RWNFTSTAKING).stakeNFTsForOwner(tokens, msg.sender);
        }
    }

    function buyRwNFTFromDaoWithSpiralBits(uint256 tokenId, uint256 maxSpiralBits, bool stake) external payable {
        // Get the buyNFT price
        uint256 nftPriceInIMPISH = IImpishDAO(IMPISH).buyNFTPrice(tokenId);
        swapExactOutputMultiple(nftPriceInIMPISH, maxSpiralBits);

        IImpishDAO(IMPISH).buyNFT(tokenId);

        if (!stake) {
            // transfer the NFT to the sender
            IERC721(RWNFT).safeTransferFrom(address(this), msg.sender, tokenId);
        } else {
            uint32[] memory tokens  = new uint32[](1);
            tokens[0] = uint32(tokenId);
            IRwNFTStaking(RWNFTSTAKING).stakeNFTsForOwner(tokens, msg.sender);
        }
    }

    /// Swap with Uniswap V3 for the exact amountOut, using upto amountInMaximum of ETH
    function swapExactOutputSingle(uint256 amountOut, uint256 amountInMaximum) internal returns (uint256 amountIn) {
        // Convert to WETH, since thats what Uniswap uses
        IWETH9(WETH9).deposit{value: address(this).balance}();

        ISwapRouter.ExactOutputSingleParams memory params =
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: WETH9,
                tokenOut: IMPISH,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum,
                sqrtPriceLimitX96: 0
            });

        // Executes the swap returning the amountIn needed to spend to receive the desired amountOut.
        amountIn = swapRouter.exactOutputSingle(params);

        // For exact output swaps, the amountInMaximum may not have all been spent.
        // If the actual amount spent (amountIn) is less than the specified maximum amount, 
        // we must refund the msg.sender
        if (amountIn < amountInMaximum) {
            IWETH9(WETH9).withdraw(IWETH9(WETH9).balanceOf(address(this)));
            (bool success, ) = msg.sender.call{value: address(this).balance}("");
            require(success, "Transfer failed.");
        }
    }

     /// Swap with Uniswap V3 for the exact amountOut, using upto amountInMaximum of SPIRALBITS
    function swapExactOutputMultiple(uint256 amountOut, uint256 amountInMaximum) internal returns (uint256 amountIn) {
        // Transfer spiralbits in
        TransferHelper.safeTransferFrom(SPIRALBITS, msg.sender, address(this), amountInMaximum);

        ISwapRouter.ExactOutputParams memory params =
            ISwapRouter.ExactOutputParams({
                path: abi.encodePacked(IMPISH, poolFee, WETH9, poolFee, SPIRALBITS),
                recipient: address(this),
                deadline: block.timestamp,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum
            });

        // Executes the swap returning the amountIn needed to spend to receive the desired amountOut.
        amountIn = swapRouter.exactOutput(params);

        // For exact output swaps, the amountInMaximum may not have all been spent.
        // If the actual amount spent (amountIn) is less than the specified maximum amount, 
        // we must refund the msg.sender
        if (amountIn < amountInMaximum) {
            TransferHelper.safeTransfer(SPIRALBITS, msg.sender, amountInMaximum - amountIn);
        }
    }

    // Default payable function, so the contract can accept any refunds
    receive() external payable {
        // Do nothing
    }

    // Function that marks this contract can accept incoming NFT transfers
    function onERC721Received(address, address, uint256 , bytes calldata) public view returns(bytes4) {
        // Only accept NFT transfers from RandomWalkNFT
        require(msg.sender == address(RWNFT), "NFT not recognized");

        // Return this value to accept the NFT
        return IERC721Receiver.onERC721Received.selector;
    }
}