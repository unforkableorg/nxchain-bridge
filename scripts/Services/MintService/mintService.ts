import { ethers } from "ethers";
import fs from 'fs';
import path from 'path';
import { getMintLogsFile } from "../../configProcess";

export interface MintLog {
  burnTxHash: string;      // Hash de la transaction de burn sur NXChain
  mintTxHash: string;      // Hash de la transaction de mint sur Substrate
  to: string;             // Adresse de destination
  amount: string;         // Montant en format string (pour la sérialisation)
  timestamp: number;      // Timestamp de la transaction
  status: 'completed' | 'failed';
  retryCount: number;
}

export class MintService {
  private provider: ethers.JsonRpcProvider;
  private mintLogs: MintLog[];
  private readonly MAX_RETRIES = 3;
  private readonly PENDING_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor(provider: ethers.JsonRpcProvider) {
    this.provider = provider;
    this.mintLogs = [];
    this.initializeMintLogs();
  }

  private initializeMintLogs(): void {
    const mintLogsFile = getMintLogsFile();
    if (!fs.existsSync(path.dirname(mintLogsFile))) {
      fs.mkdirSync(path.dirname(mintLogsFile), { recursive: true });
    }
    if (fs.existsSync(mintLogsFile)) {
      const data = fs.readFileSync(mintLogsFile, 'utf8');
      this.mintLogs = JSON.parse(data);
    }
  }

  private saveMintLogs(): void {
    fs.writeFileSync(getMintLogsFile(), JSON.stringify(this.mintLogs, null, 2));
  }

  private async cleanupPendingTransactions(): Promise<void> {
    const now = Date.now();
    const pendingTxs = this.mintLogs.filter(tx => 
      !tx.mintTxHash && (now - tx.timestamp) > this.PENDING_TIMEOUT
    );

    for (const tx of pendingTxs) {
      console.log(`Nettoyage de la transaction en attente ${tx.burnTxHash}`);
      tx.status = 'failed';
      tx.retryCount++;
    }

    this.saveMintLogs();
  }

  isTransactionProcessed(txHash: string): boolean {
    const tx = this.mintLogs.find(tx => tx.burnTxHash === txHash);
    return tx?.status === 'completed';
  }

  async mintTokens(to: string, amount: bigint, burnTxHash: string): Promise<boolean> {
    try {
      // Nettoyer les transactions en attente au démarrage
      await this.cleanupPendingTransactions();

      if (this.isTransactionProcessed(burnTxHash)) {
        console.log(`Transaction ${burnTxHash} déjà traitée avec succès, ignorée.`);
        return true;
      }

      // Créer une entrée dans les logs
      const mintLog: MintLog = {
        burnTxHash,
        mintTxHash: '',
        to,
        amount: amount.toString(),
        timestamp: Date.now(),
        status: 'failed',
        retryCount: 0
      };
      this.mintLogs.push(mintLog);
      this.saveMintLogs();

      const reserveAccountKey = process.env.RESERVE_ACCOUNT_KEY;
      
      if (!reserveAccountKey) {
        throw new Error("Clé du compte de réserve non configurée");
      }
      
      const wallet = new ethers.Wallet(reserveAccountKey, this.provider);
      const reserveBalance = await this.provider.getBalance(wallet.address);
      
      if (reserveBalance < amount) {
        throw new Error(`Solde insuffisant dans le compte de réserve. Nécessaire: ${ethers.formatEther(amount)}, Disponible: ${ethers.formatEther(reserveBalance)}`);
      }
      
      const tx = await wallet.sendTransaction({
        to: to,
        value: amount
      });
      
      // Mettre à jour le hash de la transaction de mint
      mintLog.mintTxHash = tx.hash;
      this.saveMintLogs();
      
      await tx.wait();
      
      // Marquer comme complété
      mintLog.status = 'completed';
      this.saveMintLogs();
      
      return true;
    } catch (error) {
      console.error(`Erreur lors du minting des tokens pour ${to}:`, error);
      // Mettre à jour le statut en cas d'échec
      const mintLog = this.mintLogs.find(log => log.burnTxHash === burnTxHash);
      if (mintLog) {
        mintLog.status = 'failed';
        mintLog.retryCount++;
        this.saveMintLogs();
      }
      return false;
    }
  }
} 