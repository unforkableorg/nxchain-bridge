import { ethers } from "ethers";
import { processTransactionsInBatches } from '../../scripts/processBurnTransactions';
import path from 'path';
import fs from 'fs';

// Dossier de données spécifique aux tests
const TEST_DATA_DIR = path.join(__dirname, '../fixtures/data');

// Créer le dossier de données de test s'il n'existe pas
if (!fs.existsSync(TEST_DATA_DIR)) {
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

// Remplacer temporairement les constantes du fichier original
const originalDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = TEST_DATA_DIR;

export async function testProcess() {
  const provider = new ethers.JsonRpcProvider(process.env.NXCHAIN_RPC_URL);
  
  try {
    console.log("Démarrage du test de traitement par lots...");
    console.log(`Utilisation du dossier de données: ${TEST_DATA_DIR}`);
    
    // Récupérer le dernier bloc
    const latestBlock = 21413077;
    console.log(`Dernier bloc: ${latestBlock}`);
   
    // Utiliser une plage plus grande pour tester le batching
    const fromBlock = latestBlock - 10000;
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
    throw error;
  } finally {
    // Restaurer le dossier de données original
    process.env.DATA_DIR = originalDataDir;
  }
} 