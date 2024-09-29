import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const UniswapDiamondModule = buildModule("UniswapDiamondModule", (m) => {
  // Deploy ProxyAdmin
  const proxyAdmin = m.contract("ProxyAdmin", [m.getAccount()]);

  // Deploy SwapFacet
  const swapFacet = m.contract("SwapFacet");

  // Deploy UniswapDiamondInit
  const uniswapDiamondInit = m.contract("UniswapDiamondInit");

  // Deploy UniswapDiamond Proxy
  const uniswapDiamondProxy = m.contract("UniswapDiamond", [
    swapFacet,
    proxyAdmin,
    "0x" // No initialization data here
  ]);

  // Initialize the proxy
  const initData = m.calldata("UniswapDiamondInit", "initialize", [m.getAccount()]);
  m.call(proxyAdmin, "upgradeAndCall", [uniswapDiamondProxy, uniswapDiamondInit, initData]);

  return {
    proxyAdmin,
    swapFacet,
    uniswapDiamondInit,
    uniswapDiamondProxy
  };
});

export default UniswapDiamondModule;