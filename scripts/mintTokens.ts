import { ethers } from "ethers";
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Configuration pour éviter le traitement multiple d'une même transaction
const processedTxFile = path.join(__dirname, '../data/processed_transactions.json');

// Assurez-vous que le répertoire data existe
if (!fs.existsSync(path.join(__dirname, '../data'))) {
  fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
}

// Initialiser ou charger les transactions traitées
let processedTransactions: string[] = [];
try {
  if (fs.existsSync(processedTxFile)) {
    processedTransactions = JSON.parse(fs.readFileSync(processedTxFile, 'utf8'));
  } else {
    fs.writeFileSync(processedTxFile, JSON.stringify([]));
  }
} catch (error) {
  console.error("Erreur lors du chargement des transactions traitées:", error);
}

// Fonction pour enregistrer une transaction comme traitée
function markTransactionAsProcessed(txHash: string): void {
  processedTransactions.push(txHash);
  fs.writeFileSync(processedTxFile, JSON.stringify(processedTransactions));
}

// Fonction pour vérifier si une transaction a déjà été traitée
function isTransactionProcessed(txHash: string): boolean {
  return processedTransactions.includes(txHash);
}

export async function mintNewTokens(
  to: string,
  amount: bigint,
  transactionHash: string
): Promise<boolean> {
  try {
    console.log(`Préparation du transfert de tokens à l'adresse ${to}`);
    console.log(`Montant à transférer: ${ethers.formatEther(amount)}`);
    console.log(`Transaction source: ${transactionHash}`);

    // Vérifier si la transaction a déjà été traitée
    if (isTransactionProcessed(transactionHash)) {
      console.log(`Transaction ${transactionHash} déjà traitée, ignorée.`);
      return true;
    }

    // Configurer le provider EVM pour Frontier
    const provider = new ethers.JsonRpcProvider(process.env.SUBSTRATE_EVM_RPC_URL || 'http://localhost:8545');
    
    // Charger le wallet qui contrôle les fonds de réserve
    const reserveAccountKey = process.env.RESERVE_ACCOUNT_KEY;
    if (!reserveAccountKey) {
      throw new Error("Clé du compte de réserve non configurée");
    }
    
    const wallet = new ethers.Wallet(reserveAccountKey, provider);
    
    // Vérifier le solde du compte de réserve
    const reserveBalance = await provider.getBalance(wallet.address);
    console.log(`Solde du compte de réserve: ${ethers.formatEther(reserveBalance)}`);
    
    // Si le compte de réserve a un solde insuffisant
    if (reserveBalance < amount) {
      throw new Error(`Solde insuffisant dans le compte de réserve. Nécessaire: ${ethers.formatEther(amount)}, Disponible: ${ethers.formatEther(reserveBalance)}`);
    }
    
    // Effectuer le transfert en utilisant l'API EVM
    const tx = await wallet.sendTransaction({
      to: to,
      value: amount
    });
    
    console.log(`Transaction envoyée: ${tx.hash}`);
    
    // Attendre la confirmation
    const receipt = await tx.wait();
    console.log(`Transaction confirmée dans le bloc ${receipt?.blockNumber} de la substrate chain`);
    
    // Marquer la transaction comme traitée
    markTransactionAsProcessed(transactionHash);
    
    return true;
  } catch (error) {
    console.error("Erreur lors du transfert des tokens:", error);
    return false;
  }
} 