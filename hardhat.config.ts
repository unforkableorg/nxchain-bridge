import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      forking: {
        url: "https://rpc.nxchainscan.com/",
        blockNumber: undefined,
      },
    },
  },
};
export default config;
