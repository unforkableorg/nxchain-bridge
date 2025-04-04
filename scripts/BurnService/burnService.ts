import { ethers } from "ethers";
import { 
  BURN_ADDRESS, 
  NEXSTEP_TOKEN_ADDRESS, 
  NATIVE_CONVERSION_RATE, 
  ERC20_CONVERSION_RATE,
  BurnLog
  } from "../configProcess";
import { saveLastProcessedBlock, saveBurnLogs, deduplicateLogs } from "../Utils/utils";

export class BurnService {
  private provider: ethers.JsonRpcProvider;
  private existingLogs: BurnLog[];
  private processedTxHashes: Set<string>;
  private newLogs: BurnLog[];

  constructor(provider: ethers.JsonRpcProvider) {
    this.provider = provider;
    this.existingLogs = [];
    this.processedTxHashes = new Set();
    this.newLogs = [];
  }

  async processNativeTransaction(log: any, tx: any, block: any): Promise<BurnLog | null> {
    const amount = tx.value;
    if (amount === 0n) {
      console.log(`Transaction ${log.transactionHash} ignorée car le montant est 0`);
      return null;
    }

    const convertedAmount = (amount * BigInt(Math.floor(NATIVE_CONVERSION_RATE * 1000000))) / BigInt(1000000);
    
    console.log(`\nTransaction CXS reçue:`);
    console.log(`De: ${tx.from}`);
    console.log(`Montant original: ${ethers.formatEther(amount)} CXS`);
    console.log(`Montant converti: ${ethers.formatEther(convertedAmount)} REVO`);
    console.log(`Hash de la transaction: ${log.transactionHash}`);

    const burnLog: BurnLog = {
      from: tx.from,
      amount: convertedAmount,
      originalAmount: amount,
      transactionHash: log.transactionHash,
      type: 'native',
      blockNumber: log.blockNumber,
      timestamp: block.timestamp
    };

    this.newLogs.push(burnLog);
    return burnLog;
  }

  async processERC20Transaction(log: any, tx: any, block: any): Promise<BurnLog | null> {
    const iface = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
    const decodedLog = iface.parseLog(log);
    
    if (!decodedLog) return null;

    const from = decodedLog.args[0];
    const amount = decodedLog.args[2];
    
    if (amount === 0n) {
      console.log(`Transaction ${log.transactionHash} ignorée car le montant est 0`);
      return null;
    }

    const convertedAmount = (amount * BigInt(Math.floor(ERC20_CONVERSION_RATE * 1000000))) / BigInt(1000000);
    
    console.log(`\nTransaction NexStep reçue:`);
    console.log(`De: ${from}`);
    console.log(`Montant original: ${ethers.formatEther(amount)} NexStep`);
    console.log(`Montant converti: ${ethers.formatEther(convertedAmount)} NexStep`);
    console.log(`Hash de la transaction: ${log.transactionHash}`);

    const burnLog: BurnLog = {
      from: from,
      amount: convertedAmount,
      originalAmount: amount,
      transactionHash: log.transactionHash,
      type: 'erc20',
      blockNumber: log.blockNumber,
      timestamp: block.timestamp
    };

    this.newLogs.push(burnLog);
    return burnLog;
  }

  async processTransactions(fromBlock: number, toBlock: number): Promise<BurnLog[]> {
    // Récupérer les logs natifs
    const nativeFilter = {
      fromBlock,
      toBlock,
      to: BURN_ADDRESS
    };

    // Récupérer les logs ERC20
    const erc20Filter = {
      fromBlock,
      toBlock,
      address: NEXSTEP_TOKEN_ADDRESS,
      topics: [
        ethers.id("Transfer(address,address,uint256)"),
        null,
        ethers.zeroPadValue(BURN_ADDRESS, 32)
      ]
    };

    const nativeLogs = await this.provider.getLogs(nativeFilter);
    const erc20Logs = await this.provider.getLogs(erc20Filter);

    const burnLogs: BurnLog[] = [];

    // Traiter les transactions natives
    for (const log of nativeLogs) {
      if (this.processedTxHashes.has(log.transactionHash)) continue;

      const tx = await this.provider.getTransaction(log.transactionHash);
      const block = await this.provider.getBlock(log.blockNumber);
      if (!tx || !block) continue;

      const burnLog = await this.processNativeTransaction(log, tx, block);
      if (burnLog) {
        this.processedTxHashes.add(log.transactionHash);
        burnLogs.push(burnLog);
      }
    }

    // Traiter les transactions ERC20
    for (const log of erc20Logs) {
      if (this.processedTxHashes.has(log.transactionHash)) continue;

      const tx = await this.provider.getTransaction(log.transactionHash);
      const block = await this.provider.getBlock(log.blockNumber);
      if (!tx || !block) continue;

      const burnLog = await this.processERC20Transaction(log, tx, block);
      if (burnLog) {
        this.processedTxHashes.add(log.transactionHash);
        burnLogs.push(burnLog);
      }
    }

    // Sauvegarder les résultats avec déduplication
    if (this.newLogs.length > 0) {
      const allLogs = [...this.existingLogs, ...this.newLogs];
      const uniqueLogs = deduplicateLogs(allLogs);
      saveBurnLogs(uniqueLogs);
    }
    saveLastProcessedBlock(toBlock);

    return burnLogs;
  }
} 