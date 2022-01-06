// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

pragma abicoder v2;

import "hardhat/console.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

abstract contract IWETH9 {
    function deposit() external payable virtual;
    function withdraw(uint256 amount) external virtual;
    function balanceOf(address owner) external virtual returns (uint256);
}

contract BuyWithEther {
    // For the scope of these swap examples,
    // we will detail the design considerations when using
    // `exactInput`, `exactInputSingle`, `exactOutput`, and  `exactOutputSingle`.

    // It should be noted that for the sake of these examples, we purposefully pass in the swap router instead of inherit the swap router for simplicity.
    // More advanced example contracts will detail how to inherit the swap router safely.

    ISwapRouter public immutable swapRouter;

    // This example swaps DAI/WETH9 for single path swaps and DAI/USDC/WETH9 for multi path swaps.

    address public constant WETH9 = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address public constant IMPISH = 0x36F6d831210109719D15abAEe45B327E9b43D6C6;

    // For this example, we will set the pool fee to 1%.
    uint24 public constant poolFee = 10000;

    constructor(ISwapRouter _swapRouter) {
        swapRouter = _swapRouter;

        // Approve the router to spend the specifed `amountInMaximum` of WETH9.
        TransferHelper.safeApprove(WETH9, address(swapRouter), 2**256 - 1);
    }

    /// @notice swapExactOutputSingle swaps a minimum possible amount of DAI for a fixed amount of WETH.
    /// @dev The calling address must approve this contract to spend its DAI for this function to succeed. As the amount of input DAI is variable,
    /// the calling address will need to approve for a slightly higher amount, anticipating some variance.
    /// @param amountOut The exact amount of WETH9 to receive from the swap.
    /// @param amountInMaximum The amount of DAI we are willing to spend to receive the specified amount of WETH9.
    /// @return amountIn The amount of DAI actually spent in the swap.
    function swapExactOutputSingle(uint256 amountOut, uint256 amountInMaximum) external payable returns (uint256 amountIn) {
        // Transfer the specified amount of DAI to this contract.
        // TransferHelper.safeTransferFrom(WETH9, msg.sender, address(this), amountInMaximum);
        console.log("Depositing");
        IWETH9(WETH9).deposit{value: address(this).balance}();
        console.log(IWETH9(WETH9).balanceOf(address(this)));

        console.log("Swapping");
        ISwapRouter.ExactOutputSingleParams memory params =
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: WETH9,
                tokenOut: IMPISH,
                fee: poolFee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum,
                sqrtPriceLimitX96: 0
            });

        console.log("execitig");
        // Executes the swap returning the amountIn needed to spend to receive the desired amountOut.
        amountIn = swapRouter.exactOutputSingle(params);

        // For exact output swaps, the amountInMaximum may not have all been spent.
        // If the actual amount spent (amountIn) is less than the specified maximum amount, we must refund the msg.sender and approve the swapRouter to spend 0.
        if (amountIn < amountInMaximum) {
            console.log("returining");
            IWETH9(WETH9).withdraw(IWETH9(WETH9).balanceOf(address(this)));
            (bool success, ) = msg.sender.call{value: address(this).balance}("");
            require(success, "Transfer failed.");
        }
    }

    // Default payable function, so the contract can accept any refunds
    receive() external payable {
        // Do nothing
    }
}