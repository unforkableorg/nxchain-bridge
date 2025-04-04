import dotenv from 'dotenv';
dotenv.config();
import { expect } from "chai";
import { setTestMode } from "../../scripts/configProcess";
import { processTransactionsInBatches } from "../../scripts/ProcessTransaction/processTransaction";
import fs from 'fs';
import { getBurnLogsFile, getMintLogsFile } from "../../scripts/configProcess";

interface BurnLog {
  from: string;
  amount: string;
  originalAmount: string;
  transactionHash: string;
  type: string;
  blockNumber: number;
  timestamp: number;
}

interface MintLog {
  burnTxHash: string;
  mintTxHash: string;
  to: string;
  amount: string;
  timestamp: number;
  status: 'completed' | 'pending' | 'failed';
  retryCount: number;
}

describe("processTransaction Tests", () => {
    before(() => {
        // Activer le mode test
        setTestMode(true);
        
        // Supprimer les fichiers de log dans le dossier data test
        const burnLogsFile = getBurnLogsFile();
        const mintLogsFile = getMintLogsFile();
        
        if (fs.existsSync(burnLogsFile)) {
            fs.unlinkSync(burnLogsFile);
        }
        if (fs.existsSync(mintLogsFile)) {
            fs.unlinkSync(mintLogsFile);
        }
    });

  it("should process all blocks from 21804739 to 21805739", async () => {
    await processTransactionsInBatches(21804739, 21805739);
  });
  it("should create the burnLogs.json and mintLogs.json files", () => {
    const burnLogsFile = getBurnLogsFile();
    const mintLogsFile = getMintLogsFile();
    expect(fs.existsSync(burnLogsFile)).to.be.true;
    expect(fs.existsSync(mintLogsFile)).to.be.true;
  });
  it("should have valid burn logs structure", () => {
    const burnLogsFile = getBurnLogsFile();
    const burnLogs: BurnLog[] = JSON.parse(fs.readFileSync(burnLogsFile, 'utf8'));
    
    expect(Array.isArray(burnLogs)).to.be.true;
    burnLogs.forEach((log: BurnLog) => {
      expect(log).to.have.all.keys('from', 'amount', 'originalAmount', 'transactionHash', 'type', 'blockNumber', 'timestamp');
      expect(log.from).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(log.transactionHash).to.match(/^0x[a-fA-F0-9]{64}$/);
      expect(Number(log.amount)).to.be.greaterThan(0);
      expect(Number(log.blockNumber)).to.be.greaterThan(0);
    });
  });
  it("should have valid mint logs structure", () => {
    const mintLogsFile = getMintLogsFile();
    const mintLogs: MintLog[] = JSON.parse(fs.readFileSync(mintLogsFile, 'utf8'));
    
    expect(Array.isArray(mintLogs)).to.be.true;
    mintLogs.forEach((log: MintLog) => {
      expect(log).to.have.all.keys('burnTxHash', 'mintTxHash', 'to', 'amount', 'timestamp', 'status', 'retryCount');
      expect(log.burnTxHash).to.match(/^0x[a-fA-F0-9]{64}$/);
      if (log.status === 'completed') {
        expect(log.mintTxHash).to.match(/^0x[a-fA-F0-9]{64}$/);
      } else {
        expect(log.mintTxHash).to.equal('');
      }
      expect(log.to).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(Number(log.amount)).to.be.greaterThan(0);
      expect(log.status).to.be.oneOf(['completed', 'pending', 'failed']);
      expect(Number(log.retryCount)).to.be.greaterThanOrEqual(0);
    });
  });
  it("should handle failed mint transactions correctly", () => {
    const mintLogsFile = getMintLogsFile();
    const mintLogs: MintLog[] = JSON.parse(fs.readFileSync(mintLogsFile, 'utf8'));
    
    const failedMints = mintLogs.filter(log => log.status === 'failed');
    failedMints.forEach(log => {
      expect(log.mintTxHash).to.equal('');
      expect(log.retryCount).to.be.greaterThan(0);
    });

    const pendingMints = mintLogs.filter(log => log.status === 'pending');
    pendingMints.forEach(log => {
      expect(log.mintTxHash).to.equal('');
    });

    const completedMints = mintLogs.filter(log => log.status === 'completed');
    completedMints.forEach(log => {
      expect(log.mintTxHash).to.match(/^0x[a-fA-F0-9]{64}$/);
      expect(log.retryCount).to.equal(0);
    });
  });
  it("should have matching burn and mint transactions", () => {
    const burnLogsFile = getBurnLogsFile();
    const mintLogsFile = getMintLogsFile();
    const burnLogs: BurnLog[] = JSON.parse(fs.readFileSync(burnLogsFile, 'utf8'));
    const mintLogs: MintLog[] = JSON.parse(fs.readFileSync(mintLogsFile, 'utf8'));

    // Vérifier que chaque burn a un mint correspondant
    burnLogs.forEach((burn: BurnLog) => {
      const matchingMint = mintLogs.find((mint: MintLog) => mint.burnTxHash === burn.transactionHash);
      expect(matchingMint).to.exist;
      const mint = matchingMint as MintLog;
      expect(mint.amount).to.equal(burn.amount);
      expect(mint.to).to.equal(burn.from);
    });

    // Vérifier que chaque mint a un burn correspondant
    mintLogs.forEach((mint: MintLog) => {
      const matchingBurn = burnLogs.find((burn: BurnLog) => burn.transactionHash === mint.burnTxHash);
      expect(matchingBurn).to.exist;
      const burn = matchingBurn as BurnLog;
      expect(burn.amount).to.equal(mint.amount);
      expect(burn.from).to.equal(mint.to);
    });
  });
});

//TODO Gestion des cas avec les transactions mint en pending ou echouées.
