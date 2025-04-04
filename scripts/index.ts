import dotenv from 'dotenv';
dotenv.config();

import { 
  CONFIRMATIONS_REQUIRED,
  nxchainProvider
} from "./configProcess";
import { getLastProcessedBlock, saveLastProcessedBlock } from "./Utils/utils";
import { processTransactionsInBatches } from "./ProcessTransaction/processTransaction";

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

      const lastProcessedBlock = getLastProcessedBlock();
      const currentBlock = await nxchainProvider.getBlockNumber();
      const targetBlock = currentBlock - CONFIRMATIONS_REQUIRED;

      if (targetBlock > lastProcessedBlock) {
        console.log(`Traitement des blocs ${lastProcessedBlock + 1} à ${targetBlock}`);
        const newLastProcessedBlock = await processTransactionsInBatches(lastProcessedBlock + 1, targetBlock);
        saveLastProcessedBlock(newLastProcessedBlock);
      } else {
        console.log("Aucun nouveau block à traiter");
      }

      // Attendre avant la prochaine itération
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.error("Erreur lors du traitement:", error);
      // Attendre avant de réessayer
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Erreur fatale:", error);
    process.exit(1);
  });
} 