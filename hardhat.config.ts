import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      chainId: 785,
      forking: {
        url: "https://rpc.nxchainscan.com/",
        blockNumber: 1,
      },
    },
    nxchainFork: {
      url: "https://rpc.nxchainscan.com/",
      chainId: 785,
      forking: {
        url: "https://rpc.nxchainscan.com/",
        blockNumber: 1,
      },
    },  
    substrate: {
      url: "http://localhost:8545",
      chainId: 42,  // Chain ID pour le réseau de test Substrate      
    },
  }, 
};
export default config;
