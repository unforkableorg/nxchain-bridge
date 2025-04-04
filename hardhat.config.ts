import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// Définition de la tâche testProcess
task("testProcess", "Execute the test process script")
  .setAction(async (taskArgs, hre) => {
    const { testProcess } = await import("./scripts/testProcess");
    await testProcess();
  });

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
    nxchain: {
      url: "https://rpc.nxchainscan.com/",
      chainId: 785,
    },  
    substrate: {
      url: "http://localhost:8545",
      chainId: 42,  // Chain ID pour le réseau de test Substrate      
    },
  }, 
};
export default config;
