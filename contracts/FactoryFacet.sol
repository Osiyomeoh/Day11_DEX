// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./libraries/LibDiamond.sol";
import "./PairFacet.sol";


interface IPairFacet {
    function initialize(address token0, address token1) external;
}

contract FactoryFacet {
    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, 'UniswapV2: IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'UniswapV2: ZERO_ADDRESS');
        
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        require(ds.getPair[token0][token1] == address(0), 'UniswapV2: PAIR_EXISTS');

        bytes memory bytecode = type(PairFacet).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        
        // Initialize the pair
        IPairFacet(pair).initialize(token0, token1);

        ds.getPair[token0][token1] = pair;
        ds.getPair[token1][token0] = pair; // populate mapping in the reverse direction
        ds.allPairs.push(pair);
        
        emit PairCreated(token0, token1, pair, ds.allPairs.length);
    }

    function allPairsLength() external view returns (uint) {
        return LibDiamond.diamondStorage().allPairs.length;
    }

    function getPair(address tokenA, address tokenB) external view returns (address) {
        return LibDiamond.diamondStorage().getPair[tokenA][tokenB];
    }
}