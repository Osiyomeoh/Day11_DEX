// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SwapFacet {
    using SafeERC20 for IERC20;

    struct Pair {
        address token0;
        address token1;
        uint256 reserve0;
        uint256 reserve1;
    }

    mapping(bytes32 => Pair) public pairs;

    event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to);

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        address to
    ) external returns (uint256 amountOut) {
        require(tokenIn != tokenOut, "Invalid pair");
        bytes32 pairKey = _getPairKey(tokenIn, tokenOut);
        Pair storage pair = pairs[pairKey];
        require(pair.token0 != address(0), "Pair does not exist");

        (uint256 reserveIn, uint256 reserveOut) = _getReserves(pair, tokenIn);

        amountOut = _calculateAmountOut(amountIn, reserveIn, reserveOut);
        require(amountOut >= amountOutMin, "Insufficient output amount");

        _transferTokens(tokenIn, tokenOut, amountIn, amountOut, to);
        _updateReserves(pairKey);

        _emitSwapEvent(pair, tokenIn, amountIn, amountOut, to);

        return amountOut;
    }

    function _getReserves(Pair storage pair, address tokenIn) private view returns (uint256 reserveIn, uint256 reserveOut) {
        (reserveIn, reserveOut) = tokenIn == pair.token0 
            ? (pair.reserve0, pair.reserve1) 
            : (pair.reserve1, pair.reserve0);
    }

    function _calculateAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) private pure returns (uint256) {
        uint256 amountInWithFee = amountIn * 997;
        return (amountInWithFee * reserveOut) / (reserveIn * 1000 + amountInWithFee);
    }

    function _transferTokens(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, address to) private {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(to, amountOut);
    }

    function _emitSwapEvent(Pair storage pair, address tokenIn, uint256 amountIn, uint256 amountOut, address to) private {
        emit Swap(
            msg.sender,
            tokenIn == pair.token0 ? amountIn : 0,
            tokenIn == pair.token1 ? amountIn : 0,
            tokenIn == pair.token0 ? 0 : amountOut,
            tokenIn == pair.token1 ? 0 : amountOut,
            to
        );
    }

    function _getPairKey(address tokenA, address tokenB) internal pure returns (bytes32) {
        return tokenA < tokenB 
            ? keccak256(abi.encodePacked(tokenA, tokenB))
            : keccak256(abi.encodePacked(tokenB, tokenA));
    }

    function _updateReserves(bytes32 pairKey) private {
        Pair storage pair = pairs[pairKey];
        pair.reserve0 = IERC20(pair.token0).balanceOf(address(this));
        pair.reserve1 = IERC20(pair.token1).balanceOf(address(this));
    }
}