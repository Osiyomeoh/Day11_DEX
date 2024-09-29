// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./libraries/LibDiamond.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract PairFacet {
    using SafeERC20 for IERC20;

    uint public constant MINIMUM_LIQUIDITY = 10**3;
    bytes4 private constant SELECTOR = bytes4(keccak256(bytes('transfer(address,uint256)')));

    event Mint(address indexed sender, uint amount0, uint amount1);
    event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint amount0In,
        uint amount1In,
        uint amount0Out,
        uint amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);

    function mint(address to) external returns (uint liquidity) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        uint balance0 = IERC20(ds.token0).balanceOf(address(this));
        uint balance1 = IERC20(ds.token1).balanceOf(address(this));
        uint amount0 = balance0 - _reserve0;
        uint amount1 = balance1 - _reserve1;

        uint _totalSupply = ds.totalSupply;
        if (_totalSupply == 0) {
            liquidity = Math.sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            ds.balanceOf[address(0)] = MINIMUM_LIQUIDITY; // permanently lock the first MINIMUM_LIQUIDITY tokens
        } else {
            liquidity = Math.min(amount0 * _totalSupply / _reserve0, amount1 * _totalSupply / _reserve1);
        }
        require(liquidity > 0, 'UniswapV2: INSUFFICIENT_LIQUIDITY_MINTED');
        ds.balanceOf[to] += liquidity;
        ds.totalSupply += liquidity;

        _update(balance0, balance1, _reserve0, _reserve1);
        emit Mint(msg.sender, amount0, amount1);
    }

    function burn(address to) external returns (uint amount0, uint amount1) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        address _token0 = ds.token0;
        address _token1 = ds.token1;
        uint balance0 = IERC20(_token0).balanceOf(address(this));
        uint balance1 = IERC20(_token1).balanceOf(address(this));
        uint liquidity = ds.balanceOf[address(this)];

        uint _totalSupply = ds.totalSupply;
        amount0 = liquidity * balance0 / _totalSupply;
        amount1 = liquidity * balance1 / _totalSupply;
        require(amount0 > 0 && amount1 > 0, 'UniswapV2: INSUFFICIENT_LIQUIDITY_BURNED');
        ds.balanceOf[address(this)] -= liquidity;
        ds.totalSupply -= liquidity;

        IERC20(_token0).safeTransfer(to, amount0);
        IERC20(_token1).safeTransfer(to, amount1);
        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));

        _update(balance0, balance1, _reserve0, _reserve1);
        emit Burn(msg.sender, amount0, amount1, to);
    }

    function swap(uint amount0Out, uint amount1Out, address to) external {
        require(amount0Out > 0 || amount1Out > 0, 'UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT');
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        require(amount0Out < _reserve0 && amount1Out < _reserve1, 'UniswapV2: INSUFFICIENT_LIQUIDITY');

        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        address _token0 = ds.token0;
        address _token1 = ds.token1;

        if (amount0Out > 0) IERC20(_token0).safeTransfer(to, amount0Out);
        if (amount1Out > 0) IERC20(_token1).safeTransfer(to, amount1Out);
        // Remove the following line:
        // if (data.length > 0) IUniswapV2Callee(to).uniswapV2Call(msg.sender, amount0Out, amount1Out, data);

        uint balance0 = IERC20(_token0).balanceOf(address(this));
        uint balance1 = IERC20(_token1).balanceOf(address(this));

        uint amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, 'UniswapV2: INSUFFICIENT_INPUT_AMOUNT');

        { // scope for reserve{0,1}Adjusted, avoids stack too deep errors
        uint balance0Adjusted = balance0 * 1000 - amount0In * 3;
        uint balance1Adjusted = balance1 * 1000 - amount1In * 3;
        require(balance0Adjusted * balance1Adjusted >= uint(_reserve0) * _reserve1 * (1000**2), 'UniswapV2: K');
        }

        _update(balance0, balance1, _reserve0, _reserve1);
        emitSwapEvent(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    function sync() external {
        _update(
            IERC20(LibDiamond.diamondStorage().token0).balanceOf(address(this)),
            IERC20(LibDiamond.diamondStorage().token1).balanceOf(address(this)),
            LibDiamond.diamondStorage().reserve0,
            LibDiamond.diamondStorage().reserve1
        );
    }

    function getReserves() public view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        reserve0 = ds.reserve0;
        reserve1 = ds.reserve1;
        blockTimestampLast = ds.blockTimestampLast;
    }

    function _update(uint balance0, uint balance1, uint112 _reserve0, uint112 _reserve1) private {
        require(balance0 <= type(uint112).max && balance1 <= type(uint112).max, 'UniswapV2: OVERFLOW');
        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        uint32 timeElapsed = blockTimestamp - ds.blockTimestampLast;
        if (timeElapsed > 0 && _reserve0 != 0 && _reserve1 != 0) {
            ds.price0CumulativeLast += uint(FixedPoint.uqdiv(FixedPoint.encode(_reserve1), _reserve0)) * timeElapsed;
            ds.price1CumulativeLast += uint(FixedPoint.uqdiv(FixedPoint.encode(_reserve0), _reserve1)) * timeElapsed;
        }
        ds.reserve0 = uint112(balance0);
        ds.reserve1 = uint112(balance1);
        ds.blockTimestampLast = blockTimestamp;
        emit Sync(ds.reserve0, ds.reserve1);
    }

    function initialize(address _token0, address _token1) external {
        // Initialization logic here
    }

    function emitSwapEvent(address sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address to) private {
        emit Swap(sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }
}

library FixedPoint {
    function encode(uint112 x) internal pure returns (uint224) {
        return uint224(x) << 112;
    }

    function uqdiv(uint224 x, uint112 y) internal pure returns (uint224) {
        return uint224((uint256(x) << 112) / y);
    }
}