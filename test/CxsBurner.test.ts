import { expect } from "chai";
import { ethers } from "hardhat";

describe("CxsBurner", function () {
  let cxsBurner: any;
  let addr1: any;

  beforeEach(async function () {
    [addr1] = await ethers.getSigners();
    const CxsBurner = await ethers.getContractFactory("CxsBurner");
    cxsBurner = await CxsBurner.deploy();
    await cxsBurner.waitForDeployment();
  });

  describe("Réception de CXS", function () {
    it("Devrait émettre l'événement CxsReceived lors de la réception de CXS", async function () {
      const amount = ethers.parseEther("1.0");
      
      await expect(addr1.sendTransaction({
        to: await cxsBurner.getAddress(),
        value: amount
      }))
        .to.emit(cxsBurner, "CxsReceived")
        .withArgs(addr1.address, amount);
    });
  });

  describe("Burn de CXS", function () {
    it("Devrait émettre l'événement CxsBurned et brûler les CXS", async function () {
      const amount = ethers.parseEther("1.0");
      
      // Envoyer des CXS au contrat
      await addr1.sendTransaction({
        to: await cxsBurner.getAddress(),
        value: amount
      });

      // Vérifier que l'événement CxsBurned est émis
      await expect(addr1.sendTransaction({
        to: await cxsBurner.getAddress(),
        value: amount
      }))
        .to.emit(cxsBurner, "CxsBurned")
        .withArgs(amount);

      // Vérifier que le contrat n'a plus de CXS
      const contractBalance = await ethers.provider.getBalance(await cxsBurner.getAddress());
      expect(contractBalance).to.equal(0n);
    });
  });
}); 