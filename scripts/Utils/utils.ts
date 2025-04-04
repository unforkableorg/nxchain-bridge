import fs from "fs";
import { getLastProcessedBlockFile, getBurnLogsFile, BurnLog } from "../configProcess";

// Fonction pour sauvegarder le dernier bloc traité
export function saveLastProcessedBlock(blockNumber: number) {
  fs.writeFileSync(getLastProcessedBlockFile(), JSON.stringify({ lastProcessedBlock: blockNumber }, null, 2));
}

// Fonction pour récupérer le dernier bloc traité
export function getLastProcessedBlock(): number {
  try {
    const data = fs.readFileSync(getLastProcessedBlockFile(), 'utf8');
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
  
  fs.writeFileSync(getBurnLogsFile(), JSON.stringify(serializableLogs, null, 2));
}

// Fonction pour charger les logs
export function loadBurnLogs(): BurnLog[] {
  try {
    const data = fs.readFileSync(getBurnLogsFile(), 'utf8');
    const logs = JSON.parse(data);
    // Convertir les strings en BigInt
    return logs.map((log: any) => ({
      ...log,
      amount: BigInt(log.amount),
      originalAmount: BigInt(log.originalAmount)
    }));
  } catch (error) {
    console.error('Erreur lors de la lecture des logs:', error);
    return [];
  }
}

// Fonction pour dédupliquer les logs
export function deduplicateLogs(logs: any[]): any[] {
  const seen = new Set();
  return logs.filter(log => {
    const duplicate = seen.has(log.transactionHash);
    seen.add(log.transactionHash);
    return !duplicate;
  });
} 