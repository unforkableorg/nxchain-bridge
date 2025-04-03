import { ethers } from "ethers";
import { processTransactionsInBatches } from './processBurnTransactions';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.NXCHAIN_RPC_URL);
  
  try {
    console.log("Démarrage du test de traitement par lots...");
    
    // Récupérer le dernier bloc
    const latestBlock = 21413077
    console.log(`Dernier bloc: ${latestBlock}`);
   
    // Utiliser une plage plus grande pour tester le batching
    const fromBlock = latestBlock - 10000; // 5000 blocs en arrière
    const toBlock = latestBlock;
    
    console.log(`\nTest de traitement des blocs ${fromBlock} à ${toBlock}`);
    console.log(`Cette plage sera divisée en lots de 1000 blocs`);
    
    const startTime = Date.now();
    await processTransactionsInBatches(fromBlock, toBlock, provider);
    const endTime = Date.now();
    
    console.log(`\nTest terminé avec succès !`);
    console.log(`Temps total d'exécution: ${(endTime - startTime) / 1000} secondes`);
  } catch (error) {
    console.error("Erreur lors du test:", error);
  }
}

main().catch((error) => {
  console.error("Erreur fatale:", error);
  process.exit(1);
}); 