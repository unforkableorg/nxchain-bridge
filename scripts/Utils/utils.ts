import fs from "fs";
import { LAST_PROCESSED_BLOCK_FILE, BURN_LOGS_FILE, BurnLog } from "../configProcess";

// Fonction pour sauvegarder le dernier bloc traité
export function saveLastProcessedBlock(blockNumber: number) {
  fs.writeFileSync(LAST_PROCESSED_BLOCK_FILE, JSON.stringify({ lastProcessedBlock: blockNumber }, null, 2));
}

// Fonction pour récupérer le dernier bloc traité
export function getLastProcessedBlock(): number {
  try {
    const data = fs.readFileSync(LAST_PROCESSED_BLOCK_FILE, 'utf8');
    return JSON.parse(data).lastProcessedBlock;
  } catch (error) {
    console.error('Erreur lors de la lecture du dernier bloc traité:', error);
  }
  return 0;
}

// Fonction pour sauvegarder les logs
export function saveBurnLogs(logs: BurnLog[]) {
  // Convertir les BigInt en strings pour la sérialisation
  const serializableLogs = logs.map(log => ({
    ...log,
    amount: log.amount.toString(),
    originalAmount: log.originalAmount.toString()
  }));
  
  fs.writeFileSync(BURN_LOGS_FILE, JSON.stringify(serializableLogs, null, 2));
}

// Fonction pour charger les logs
export function loadBurnLogs(): BurnLog[] {
  try {
    if (fs.existsSync(BURN_LOGS_FILE)) {
      return JSON.parse(fs.readFileSync(BURN_LOGS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Erreur lors de la lecture des logs:', error);
  }
  return [];
}

// Fonction pour dédupliquer les logs
export function deduplicateLogs(logs: any[]): any[] {
  const uniqueLogs = new Map();
  logs.forEach(log => {
    uniqueLogs.set(log.transactionHash, log);
  });
  return Array.from(uniqueLogs.values());
} 