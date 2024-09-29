// import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
// import { expect } from "chai";
// import { ethers } from "hardhat";
// // import { Contract, Signer } from "ethers";
// // import { FormatTypes } from "ethers/lib/utils";

// // Remove the getSelectors function

// describe("DiamondDex", function () {
//   async function deployDiamondDexFixture() {
//     const [owner, addr1, addr2] = await ethers.getSigners();

//     // Deploy DiamondCutFacet
//     const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
//     const diamondCutFacet = await DiamondCutFacet.deploy();

//     // Deploy Diamond
//     const Diamond = await ethers.getContractFactory("UniswapDiamond");
//     const deployedDiamond = await Diamond.deploy(await owner.getAddress(), diamondCutFacet.target);
//     await deployedDiamond.waitForDeployment();

//     // Get the diamond instance
//     const diamond = await ethers.getContractAt("UniswapDiamond", await deployedDiamond.getAddress());

//     // Deploy and add facets
//     const FacetNames = [
//       "DiamondLoupeFacet",
//       "OwnershipFacet",
//       "UniswapV2FactoryFacet",
//       "UniswapV2RouterFacet",
//       "UniswapV2SwapFacet"
//     ];
    
//     const cut = [];
//     for (const FacetName of FacetNames) {
//       const Facet = await ethers.getContractFactory(FacetName);
//       const facet = await Facet.deploy();
//       await facet.waitForDeployment();
//       cut.push({
//         facetAddress: await facet.getAddress(),
//         action: 0, // Add
//         functionSelectors: Object.keys(facet.interface.functions).map(
//           func => facet.interface.getSighash(func)
//         ).filter(selector => selector !== '0xc4d66de8') // Exclude init function
//       });
//     }

//     // Add the facets to the diamond
//     const diamondCut = await ethers.getContractAt('IDiamondCut', await diamond.getAddress());
//     await diamondCut.diamondCut(cut, ethers.ZeroAddress, '0x');

//     // Get facet instances
//     const factoryFacet = await ethers.getContractAt("UniswapV2FactoryFacet", await diamond.getAddress());
//     const routerFacet = await ethers.getContractAt("UniswapV2RouterFacet", await diamond.getAddress());
//     const swapFacet = await ethers.getContractAt("UniswapV2SwapFacet", await diamond.getAddress());

//     // Deploy mock tokens
//     const MockToken = await ethers.getContractFactory("MockERC20");
//     const tokenA = await MockToken.deploy("Token A", "TKA");
//     const tokenB = await MockToken.deploy("Token B", "TKB");

//     return { diamond, factoryFacet, routerFacet, swapFacet, tokenA, tokenB, owner, addr1, addr2 };
//   }

//   describe("Pair Creation", function () {
//     it("Should create a new pair", async function () {
//       const { factoryFacet, tokenA, tokenB } = await loadFixture(deployDiamondDexFixture);
      
//       await expect(factoryFacet.createPair(tokenA.address, tokenB.address))
//         .to.emit(factoryFacet, "PairCreated")
//         .withArgs(tokenA.address, tokenB.address, expect.anything(), expect.anything());
//     });

//     it("Should revert when creating a pair that already exists", async function () {
//       await factoryFacet.createPair(tokenA.address, tokenB.address);
//       await expect(factoryFacet.createPair(tokenA.address, tokenB.address))
//         .to.be.revertedWith("UniswapV2: PAIR_EXISTS");
//     });
//   });

//   describe("Liquidity", function () {
//     it("Should add liquidity to a pair", async function () {
//       await factoryFacet.createPair(tokenA.address, tokenB.address);

//       const amountA = ethers.parseEther("100");
//       const amountB = ethers.parseEther("100");

//       await tokenA.mint(await addr1.getAddress(), amountA);
//       await tokenB.mint(await addr1.getAddress(), amountB);

//       await tokenA.connect(addr1).approve(diamond.address, amountA);
//       await tokenB.connect(addr1).approve(diamond.address, amountB);

//       const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now

//       await expect(routerFacet.connect(addr1).addLiquidity({
//         tokenA: tokenA.address,
//         tokenB: tokenB.address,
//         amountADesired: amountA,
//         amountBDesired: amountB,
//         amountAMin: 0,
//         amountBMin: 0,
//         to: await addr1.getAddress(),
//         deadline: deadline
//       })).to.not.be.reverted;
//     });
//   });

//   describe("Swapping", function () {
//     it("Should swap tokens", async function () {
//       await factoryFacet.createPair(tokenA.address, tokenB.address);

//       const liquidityAmount = ethers.parseEther("1000");
//       await tokenA.mint(await addr1.getAddress(), liquidityAmount);
//       await tokenB.mint(await addr1.getAddress(), liquidityAmount);

//       await tokenA.connect(addr1).approve(diamond.address, liquidityAmount);
//       await tokenB.connect(addr1).approve(diamond.address, liquidityAmount);

//       const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now

//       await routerFacet.connect(addr1).addLiquidity({
//         tokenA: tokenA.address,
//         tokenB: tokenB.address,
//         amountADesired: liquidityAmount,
//         amountBDesired: liquidityAmount,
//         amountAMin: 0,
//         amountBMin: 0,
//         to: await addr1.getAddress(),
//         deadline: deadline
//       });

//       const swapAmount = ethers.parseEther("10");
//       await tokenA.mint(await addr2.getAddress(), swapAmount);
//       await tokenA.connect(addr2).approve(diamond.address, swapAmount);

//       await expect(swapFacet.connect(addr2).swap(
//         tokenA.address,
//         tokenB.address,
//         swapAmount,
//         0,
//         await addr2.getAddress()
//       )).to.emit(swapFacet, "Swap");

//       const balanceB = await tokenB.balanceOf(await addr2.getAddress());
//       expect(balanceB).to.be.gt(0);
//     });
//   });
// });