import { ethers } from "ethers";
import { 
  BATCH_SIZE, 
  nxchainProvider,
  substrateProvider
} from "../configProcess";
import { BurnService } from "../Services/BurnService/burnService";
import { MintService } from "../Services/MintService/mintService";

export async function processTransactionsInBatches(fromBlock: number, toBlock: number) {
  const burnService = new BurnService(nxchainProvider);
  const mintService = new MintService(substrateProvider);

  // Traiter les blocs par lots
  for (let currentBlock = fromBlock; currentBlock <= toBlock; currentBlock += BATCH_SIZE) {
    const batchEndBlock = Math.min(currentBlock + BATCH_SIZE - 1, toBlock);
    console.log(`Traitement du lot de blocs ${currentBlock} à ${batchEndBlock}`);

    try {
      const burnLogs = await burnService.processTransactions(currentBlock, batchEndBlock);
      
      // Filtrer les transactions déjà traitées
      const newBurnLogs = burnLogs.filter(log => !mintService.isTransactionProcessed(log.transactionHash));
      
      // Traiter uniquement les nouvelles transactions
      for (const burnLog of newBurnLogs) {
        console.log(`Minting ${ethers.formatEther(burnLog.amount)} tokens pour ${burnLog.from}`);
        await mintService.mintTokens(burnLog.from, burnLog.amount, burnLog.transactionHash);
      }
    } catch (error) {
      console.error(`Erreur lors du traitement des blocs ${currentBlock} à ${batchEndBlock}:`, error);
      throw error;
    }
  }

  return toBlock;
} 