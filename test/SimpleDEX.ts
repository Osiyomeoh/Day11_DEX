import { ethers } from "hardhat";
import { EventLog } from "ethers";
import { expect } from "chai";
import { Contract } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("SimpleDEX", function () {
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const LIQUIDITY_AMOUNT = ethers.parseEther("1000");

  async function deployFixture() {
    const [owner, user1, user2] = await ethers.getSigners();
    
    const Token = await ethers.getContractFactory("MockERC20");
    const tokenA = await Token.deploy("Token A", "TKA", INITIAL_SUPPLY);
    const tokenB = await Token.deploy("Token B", "TKB", INITIAL_SUPPLY);

    const SimpleDEX = await ethers.getContractFactory("SimpleDEX");
    const dex = await SimpleDEX.deploy();

    // Mint more tokens to the owner
    await tokenA.mint(owner.address, ethers.parseEther("10000"));
    await tokenB.mint(owner.address, ethers.parseEther("10000"));

    // Transfer tokens to users
    await tokenA.connect(owner).transfer(user1.address, ethers.parseEther("5000"));
    await tokenB.connect(owner).transfer(user1.address, ethers.parseEther("5000"));
    await tokenA.connect(owner).transfer(user2.address, ethers.parseEther("5000"));
    await tokenB.connect(owner).transfer(user2.address, ethers.parseEther("5000"));

    // Transfer tokens to DEX
    await tokenA.connect(owner).transfer(dex.target, ethers.parseEther("1000"));
    await tokenB.connect(owner).transfer(dex.target, ethers.parseEther("1000"));

    return { dex, tokenA, tokenB, owner, user1, user2 };
  }

  describe("Liquidity", function () {
    it("Should add liquidity", async function () {
      const { dex, tokenA, tokenB, user1 } = await loadFixture(deployFixture);

      // Check user1's balance
      const user1BalanceA = await tokenA.balanceOf(user1.address);
      const user1BalanceB = await tokenB.balanceOf(user1.address);
      console.log("User1 balance before adding liquidity:", user1BalanceA, user1BalanceB);

      await tokenA.connect(user1).approve(await dex.getAddress(), LIQUIDITY_AMOUNT);
      await tokenB.connect(user1).approve(await dex.getAddress(), LIQUIDITY_AMOUNT);

      await expect(dex.connect(user1).addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT))
        .to.emit(dex, "LiquidityAdded")
        .withArgs(user1.address, await tokenA.getAddress(), await tokenB.getAddress(), LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);

      const liquidity = await dex.liquidity(await tokenA.getAddress(), await tokenB.getAddress());
      expect(liquidity).to.equal(LIQUIDITY_AMOUNT);
    });

    it("Should remove liquidity", async function () {
      const { dex, tokenA, tokenB, user1 } = await loadFixture(deployFixture);

      await tokenA.connect(user1).approve(await dex.getAddress(), LIQUIDITY_AMOUNT);
      await tokenB.connect(user1).approve(await dex.getAddress(), LIQUIDITY_AMOUNT);
      await dex.connect(user1).addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);

      const liquidityToRemove = ethers.parseEther("500");
      await expect(dex.connect(user1).removeLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), liquidityToRemove))
        .to.emit(dex, "LiquidityRemoved")
        .withArgs(user1.address, await tokenA.getAddress(), await tokenB.getAddress(), LIQUIDITY_AMOUNT / 2n, LIQUIDITY_AMOUNT / 2n);

      const remainingLiquidity = await dex.liquidity(await tokenA.getAddress(), await tokenB.getAddress());
      expect(remainingLiquidity).to.equal(ethers.parseEther("500"));
    });

    it("Should fail to add liquidity with insufficient balance", async function () {
      const { dex, tokenA, tokenB, user2 } = await loadFixture(deployFixture);

      const excessiveAmount = ethers.parseEther("10000");
      await tokenA.connect(user2).approve(await dex.getAddress(), excessiveAmount);
      await tokenB.connect(user2).approve(await dex.getAddress(), excessiveAmount);

      await expect(dex.connect(user2).addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), excessiveAmount, excessiveAmount))
        .to.be.reverted;
    });

    it("Should fail to remove more liquidity than available", async function () {
      const { dex, tokenA, tokenB, user1 } = await loadFixture(deployFixture);

      await tokenA.connect(user1).approve(await dex.getAddress(), LIQUIDITY_AMOUNT);
      await tokenB.connect(user1).approve(await dex.getAddress(), LIQUIDITY_AMOUNT);
      await dex.connect(user1).addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);

      const excessiveLiquidity = ethers.parseEther("1500");
      await expect(dex.connect(user1).removeLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), excessiveLiquidity))
        .to.be.revertedWith("Insufficient liquidity");
    });
  });

  describe("Swapping", function () {
    it("Should swap tokens", async function () {
      const { dex, tokenA, tokenB, user1, user2 } = await loadFixture(deployFixture);

      // Add liquidity first
      await tokenA.connect(user1).approve(await dex.getAddress(), LIQUIDITY_AMOUNT);
      await tokenB.connect(user1).approve(await dex.getAddress(), LIQUIDITY_AMOUNT);
      await dex.connect(user1).addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);

      const swapAmount = ethers.parseEther("10");
      await tokenA.connect(user2).approve(await dex.getAddress(), swapAmount);

      // Check user2's balance before swap
      const user2BalanceABefore = await tokenA.balanceOf(user2.address);
      const user2BalanceBBefore = await tokenB.balanceOf(user2.address);
      console.log("User2 balance before swap:", user2BalanceABefore, user2BalanceBBefore);

      const tx = await dex.connect(user2).swap(await tokenA.getAddress(), await tokenB.getAddress(), swapAmount);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      // Find the Swap event
      const swapEvent = receipt.logs.find(
        (log): log is EventLog => 'fragment' in log && log.fragment?.name === 'Swap'
      );

      if (!swapEvent) {
        throw new Error('Swap event not found');
      }

      const [, , , , amountOut] = swapEvent.args;

      console.log("Actual amount out:", amountOut);

      // Check that the amount out is close to the expected amount
      expect(amountOut).to.be.closeTo(ethers.parseEther("9.9"), ethers.parseEther("0.1"));

      const user2BalanceAAfter = await tokenA.balanceOf(user2.address);
      const user2BalanceBAfter = await tokenB.balanceOf(user2.address);
      console.log("User2 balance after swap:", user2BalanceAAfter, user2BalanceBAfter);

      // Check that user2's balance of tokenA decreased by swapAmount
      expect(user2BalanceAAfter).to.equal(user2BalanceABefore - swapAmount);

      // Check that user2's balance of tokenB increased by approximately the expected amount
      expect(user2BalanceBAfter).to.be.closeTo(user2BalanceBBefore + amountOut, ethers.parseEther("0.001"));
    });

    it("Should fail to swap with insufficient allowance", async function () {
      const { dex, tokenA, tokenB, user1, user2 } = await loadFixture(deployFixture);

      // Add liquidity first
      await tokenA.connect(user1).approve(await dex.getAddress(), LIQUIDITY_AMOUNT);
      await tokenB.connect(user1).approve(await dex.getAddress(), LIQUIDITY_AMOUNT);
      await dex.connect(user1).addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);

      const swapAmount = ethers.parseEther("100");
      // Approve less than the swap amount
      await tokenA.connect(user2).approve(await dex.getAddress(), ethers.parseEther("89"));

      await expect(dex.connect(user2).swap(await tokenA.getAddress(), await tokenB.getAddress(), swapAmount))
        .to.be.revertedWithCustomError(tokenA, "ERC20InsufficientAllowance");
    });

    it("Should swap tokens in reverse direction", async function () {
      const { dex, tokenA, tokenB, user1, user2 } = await loadFixture(deployFixture);

      // Add liquidity first
      await tokenA.connect(user1).approve(await dex.getAddress(), LIQUIDITY_AMOUNT);
      await tokenB.connect(user1).approve(await dex.getAddress(), LIQUIDITY_AMOUNT);
      await dex.connect(user1).addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);

      const swapAmount = ethers.parseEther("10");
      await tokenB.connect(user2).approve(await dex.getAddress(), swapAmount);

      const user2BalanceABefore = await tokenA.balanceOf(user2.address);
      const user2BalanceBBefore = await tokenB.balanceOf(user2.address);

      const tx = await dex.connect(user2).swap(await tokenB.getAddress(), await tokenA.getAddress(), swapAmount);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      const swapEvent = receipt.logs.find(
        (log): log is EventLog => 'fragment' in log && log.fragment?.name === 'Swap'
      );

      if (!swapEvent) {
        throw new Error('Swap event not found');
      }

      const [, , , , amountOut] = swapEvent.args;

      expect(amountOut).to.be.closeTo(ethers.parseEther("9.9"), ethers.parseEther("0.1"));

      const user2BalanceAAfter = await tokenA.balanceOf(user2.address);
      const user2BalanceBAfter = await tokenB.balanceOf(user2.address);

      expect(user2BalanceBAfter).to.equal(user2BalanceBBefore - swapAmount);
      expect(user2BalanceAAfter).to.be.closeTo(user2BalanceABefore + amountOut, ethers.parseEther("0.001"));
    });
  });

  
});