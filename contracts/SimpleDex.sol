// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract SimpleDEX {
    mapping(address => mapping(address => uint256)) public liquidity;
    mapping(address => mapping(address => uint256)) public tokenBalances;

    event LiquidityAdded(address indexed provider, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB);
    event LiquidityRemoved(address indexed provider, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB);
    event Swap(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    function addLiquidity(address tokenA, address tokenB, uint256 amountA, uint256 amountB) external {
        require(tokenA != tokenB, "Tokens must be different");
        require(amountA > 0 && amountB > 0, "Amounts must be greater than 0");

        IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountB);

        liquidity[tokenA][tokenB] += Math.sqrt(amountA * amountB);
        tokenBalances[tokenA][tokenB] += amountA;
        tokenBalances[tokenB][tokenA] += amountB;

        emit LiquidityAdded(msg.sender, tokenA, tokenB, amountA, amountB);
    }

    function removeLiquidity(address tokenA, address tokenB, uint256 liquidityAmount) external {
        require(tokenA != tokenB, "Tokens must be different");
        require(liquidityAmount > 0, "Liquidity amount must be greater than 0");
        require(liquidity[tokenA][tokenB] >= liquidityAmount, "Insufficient liquidity");

        uint256 totalLiquidity = liquidity[tokenA][tokenB];
        uint256 amountA = (tokenBalances[tokenA][tokenB] * liquidityAmount) / totalLiquidity;
        uint256 amountB = (tokenBalances[tokenB][tokenA] * liquidityAmount) / totalLiquidity;

        liquidity[tokenA][tokenB] -= liquidityAmount;
        tokenBalances[tokenA][tokenB] -= amountA;
        tokenBalances[tokenB][tokenA] -= amountB;

        IERC20(tokenA).transfer(msg.sender, amountA);
        IERC20(tokenB).transfer(msg.sender, amountB);

        emit LiquidityRemoved(msg.sender, tokenA, tokenB, amountA, amountB);
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn) external {
        require(tokenIn != tokenOut, "Tokens must be different");
        require(amountIn > 0, "Amount must be greater than 0");
        require(tokenBalances[tokenIn][tokenOut] > 0, "Insufficient liquidity");

        uint256 reserveIn = tokenBalances[tokenIn][tokenOut];
        uint256 reserveOut = tokenBalances[tokenOut][tokenIn];

        uint256 amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997);

        require(amountOut > 0, "Insufficient output amount");
        require(amountOut < reserveOut, "Insufficient liquidity");

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).transfer(msg.sender, amountOut);

        tokenBalances[tokenIn][tokenOut] += amountIn;
        tokenBalances[tokenOut][tokenIn] -= amountOut;

        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }
}