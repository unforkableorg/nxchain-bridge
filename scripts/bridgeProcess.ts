import dotenv from 'dotenv';
dotenv.config();

import { ethers } from "ethers";
import { 
  BATCH_SIZE, 
  LAST_PROCESSED_BLOCK_FILE, 
  CONFIRMATIONS_REQUIRED, 
  PROCESS_INTERVAL,
  nxchainProvider,
  substrateProvider
} from "./configProcess";
import { getLastProcessedBlock } from "./Utils/utils";
import { BurnService } from "./BurnService/burnService";
import { MintService } from "./MintService/mintService";
import fs from 'fs';

interface LastProcessedBlock {
  lastProcessedBlock: number;
}

function loadLastProcessedBlock(): number {
  try {
    const data = fs.readFileSync(LAST_PROCESSED_BLOCK_FILE, 'utf8');
    const json: LastProcessedBlock = JSON.parse(data);
    return json.lastProcessedBlock;
  } catch (error) {
    console.log("Aucun block traité précédemment trouvé, démarrage depuis le block 0");
    return 0;
  }
}

function saveLastProcessedBlock(blockNumber: number) {
  const data: LastProcessedBlock = { lastProcessedBlock: blockNumber };
  fs.writeFileSync(LAST_PROCESSED_BLOCK_FILE, JSON.stringify(data, null, 2));
}

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

async function main() {
  console.log(`Démarrage du bridge pour l'adresse de burn`);
  console.log(`RPC NXChain: ${process.env.NXCHAIN_RPC_URL}`);
  console.log(`RPC Substrate: ${process.env.SUBSTRATE_EVM_RPC_URL}`);

  while (true) {
    try {
      console.log("Connexion au réseau NXChain...");
      
      // Vérification de la connexion
      await nxchainProvider.getNetwork();
      console.log("Connecté au réseau NXChain");

      const lastProcessedBlock = loadLastProcessedBlock();
      const currentBlock = await nxchainProvider.getBlockNumber();
      const targetBlock = currentBlock - CONFIRMATIONS_REQUIRED;

      if (targetBlock > lastProcessedBlock) {
        console.log(`Traitement des blocs ${lastProcessedBlock + 1} à ${targetBlock}`);
        const newLastProcessedBlock = await processTransactionsInBatches(lastProcessedBlock + 1, targetBlock);
        saveLastProcessedBlock(newLastProcessedBlock);
      } else {
        console.log("Aucun nouveau block à traiter");
      }

      // Attendre l'intervalle avant la prochaine vérification
      await new Promise(resolve => setTimeout(resolve, PROCESS_INTERVAL));

    } catch (error) {
      console.error("Erreur:", error);
      console.log(`Nouvelle tentative dans ${PROCESS_INTERVAL/1000} secondes...`);
      await new Promise(resolve => setTimeout(resolve, PROCESS_INTERVAL));
    }
  }
}

// Gestion des erreurs non capturées
process.on("uncaughtException", (error) => {
  console.error("Erreur non capturée:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Promesse rejetée non gérée:", error);
});

main().catch((error) => {
  console.error("Erreur fatale:", error);
  process.exit(1);
}); 