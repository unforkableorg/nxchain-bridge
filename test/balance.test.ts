import { expect } from "chai";
import { ethers } from "hardhat";

describe("Balance Check", function () {
  it("Should get the balance of the specified address", async function () {
    const address = "0x46d1caa3d94414088ee14a5a259070610fd00150";
    
    try {
      // Log the current network
      const network = await ethers.provider.getNetwork();
      console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);
      
      // Get the balance
      console.log("Fetching balance...");
      const balance = await ethers.provider.getBalance(address);
      
      // Convert from wei to ether for better readability
      const balanceInEther = ethers.formatEther(balance);
      
      console.log(`Balance of ${address}:`);
      console.log(`Raw balance: ${balance.toString()} wei`);
      console.log(`Formatted balance: ${balanceInEther} CXS`);
      
      // Basic assertion to ensure we got a valid balance
      expect(balance).to.be.gte(0);
    } catch (error) {
      console.error("Error details:", error);
      throw error;
    }
  });


});