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
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  lastError?: string;     // Message d'erreur de la dernière tentative
  nonce?: number;         // Nonce de la transaction
  gasPrice?: string;      // Prix du gas utilisé
  originalGasPrice?: string; // Prix du gas initial pour les retries
  maxGasPrice?: string;   // Prix maximum du gas pour les retries
}

export interface QueueLog {
  burnTxHash: string;     // Hash de la transaction de burn sur NXChain
  to: string;             // Adresse de destination
  amount: string;         // Montant en format string
  timestamp: number;      // Timestamp de l'ajout à la queue
  retryCount: number;     // Nombre de tentatives
  priority: number;       // Priorité dans la queue
  lastError?: string;     // Message d'erreur de la dernière tentative
}

export interface MintQueueItem {
  burnTxHash: string;
  to: string;
  amount: string;
  priority: number;
  timestamp: number;
  retryCount: number;
  lastError?: string;
  nonce?: number;
  gasPrice?: string;
}

export class MintService {
  private provider: ethers.JsonRpcProvider;
  private mintLogs: MintLog[];
  private mintQueue: MintQueueItem[];
  private queueLogs: QueueLog[]; // Nouveau: logs de la queue
  private isProcessing: boolean;
  private activeNonces: Map<number, MintLog>; // Track active nonces
  private readonly MAX_RETRIES = 5;
  private readonly QUEUE_PROCESS_INTERVAL = 10000; // 10 secondes
  private readonly PENDING_TX_TIMEOUT = 60 * 1000; // 60 secondes
  private readonly GAS_PRICE_MULTIPLIER = 1.5; // Multiplicateur pour augmenter le prix du gas
  private readonly QUEUE_LOGS_FILE = path.join(process.cwd(), 'data', 'queueLogs.json'); // Nouveau: chemin du fichier de logs de queue

  constructor(provider: ethers.JsonRpcProvider) {
    this.provider = provider;
    this.mintLogs = [];
    this.mintQueue = [];
    this.queueLogs = []; // Nouveau: initialisation des logs de queue
    this.isProcessing = false;
    this.activeNonces = new Map();
    this.initializeMintLogs();
    this.initializeQueueLogs(); // Nouveau: initialisation des logs de queue
    this.startQueueProcessor();
    
    // Nettoyer les transactions en attente au démarrage
    this.cleanupPendingTransactions();
    
    // Ajouter un intervalle pour nettoyer périodiquement les transactions en attente
    setInterval(async () => {
      await this.cleanupPendingTransactions();
    }, this.QUEUE_PROCESS_INTERVAL); // Utiliser le même intervalle que pour le traitement de la queue
  }

  private initializeMintLogs(): void {
    const mintLogsFile = getMintLogsFile();
    if (!fs.existsSync(path.dirname(mintLogsFile))) {
      fs.mkdirSync(path.dirname(mintLogsFile), { recursive: true });
    }
    if (fs.existsSync(mintLogsFile)) {
      const data = fs.readFileSync(mintLogsFile, 'utf8');
      this.mintLogs = JSON.parse(data);
      
      // Initialize active nonces from existing logs
      this.mintLogs.forEach(log => {
        if (log.nonce !== undefined && (log.status === 'pending' || log.status === 'processing')) {
          this.activeNonces.set(log.nonce, log);
        }
      });
      
      // Réinitialiser les transactions en attente ou en cours de traitement
      this.mintLogs.forEach(log => {
        if (log.status === 'pending' || log.status === 'processing') {
          // Ne pas les marquer comme échouées immédiatement, vérifier d'abord sur la blockchain
          if (log.mintTxHash) {
            // Si on a un hash de transaction, on vérifiera son statut lors du nettoyage
            console.log(`Transaction ${log.burnTxHash} en attente, sera vérifiée sur la blockchain`);
          } else {
            // Si pas de hash, c'est une transaction qui n'a jamais été envoyée
            log.status = 'failed';
            log.retryCount++;
            
            // Ajouter à la queue pour retraitement
            if (log.retryCount < this.MAX_RETRIES) {
              this.addToQueue({
                burnTxHash: log.burnTxHash,
                to: log.to,
                amount: log.amount,
                priority: log.retryCount,
                timestamp: Date.now(),
                retryCount: log.retryCount,
                lastError: log.lastError
              });
            }
          }
        }
      });
      
      this.saveMintLogs();
    }
  }

  private saveMintLogs(): void {
    fs.writeFileSync(getMintLogsFile(), JSON.stringify(this.mintLogs, null, 2));
  }

  // Vérifie le statut réel d'une transaction sur la blockchain
  private async checkTransactionStatus(mintTxHash: string): Promise<'pending' | 'completed' | 'failed'> {
    try {
      if (!mintTxHash) return 'failed';
      
      // Utiliser eth_getTransactionReceipt pour vérifier le statut
      const receipt = await this.provider.getTransactionReceipt(mintTxHash);
      
      if (!receipt) {
        // Transaction toujours en attente
        return 'pending';
      }
      
      // Si la transaction a été minée
      return receipt.status === 1 ? 'completed' : 'failed';
    } catch (error) {
      console.error(`Erreur lors de la vérification de la transaction ${mintTxHash}:`, error);
      return 'failed';
    }
  }

  // Vérifie si une transaction est en attente depuis trop longtemps
  private isTransactionPendingTooLong(timestamp: number): boolean {
    return Date.now() - timestamp > this.PENDING_TX_TIMEOUT;
  }

  // Remplace une transaction en attente avec un prix de gas plus élevé
  private async replacePendingTransaction(mintLog: MintLog): Promise<boolean> {
    try {
      if (!mintLog.mintTxHash || !mintLog.nonce) {
        console.log(`Impossible de remplacer la transaction ${mintLog.burnTxHash}: hash ou nonce manquant`);
        return false;
      }

      const reserveAccountKey = process.env.RESERVE_ACCOUNT_KEY;
      if (!reserveAccountKey) {
        throw new Error("Clé du compte de réserve non configurée");
      }
      
      const wallet = new ethers.Wallet(reserveAccountKey, this.provider);
      
      // Récupérer le prix du gas actuel
      const currentGasPrice = await this.provider.getFeeData();
      const newGasPrice = currentGasPrice.gasPrice ? 
        currentGasPrice.gasPrice * BigInt(Math.floor(this.GAS_PRICE_MULTIPLIER * 100)) / BigInt(100) : 
        undefined;
      
      // Créer une nouvelle transaction avec le même nonce mais un prix de gas plus élevé
      const tx = await wallet.sendTransaction({
        to: mintLog.to,
        value: BigInt(mintLog.amount),
        nonce: mintLog.nonce,
        gasPrice: newGasPrice
      });
      
      console.log(`Transaction ${mintLog.burnTxHash} remplacée avec un nouveau hash: ${tx.hash}`);
      
      // Mettre à jour le hash de la transaction
      mintLog.mintTxHash = tx.hash;
      mintLog.gasPrice = newGasPrice?.toString();
      mintLog.timestamp = Date.now();
      this.saveMintLogs();
      
      return true;
    } catch (error) {
      console.error(`Erreur lors du remplacement de la transaction ${mintLog.burnTxHash}:`, error);
      return false;
    }
  }

  private async cleanupPendingTransactions(): Promise<void> {
    const now = Date.now();
    const pendingTxs = this.mintLogs.filter(tx => 
      (tx.status === 'pending' || tx.status === 'processing') && 
      tx.mintTxHash // On ne vérifie que les transactions qui ont un hash
    );

    for (const tx of pendingTxs) {
      // Vérifier le statut réel sur la blockchain
      const chainStatus = await this.checkTransactionStatus(tx.mintTxHash);
      
      if (chainStatus === 'completed') {
        // La transaction a réussi sur la blockchain
        tx.status = 'completed';
        console.log(`Transaction ${tx.burnTxHash} confirmée comme complétée sur la blockchain`);
      } else if (chainStatus === 'failed') {
        // La transaction a échoué sur la blockchain
        console.log(`Transaction ${tx.burnTxHash} échouée sur la blockchain, préparation pour retry`);
        tx.status = 'failed';
        tx.retryCount++;
        
        // Ajouter à la queue pour retraitement uniquement si échec confirmé
        if (tx.retryCount < this.MAX_RETRIES) {
          this.addToQueue({
            burnTxHash: tx.burnTxHash,
            to: tx.to,
            amount: tx.amount,
            priority: tx.retryCount,
            timestamp: Date.now(),
            retryCount: tx.retryCount,
            lastError: "Transaction échouée sur la blockchain"
          });
        }
      } else {
        // La transaction est toujours en pending sur la blockchain
        console.log(`Transaction ${tx.burnTxHash} toujours en attente sur la blockchain`);
        
        // Vérifier si la transaction est en attente depuis trop longtemps
        if (this.isTransactionPendingTooLong(tx.timestamp)) {
          console.log(`Transaction ${tx.burnTxHash} en attente depuis trop longtemps, réajout à la queue`);
          
          // Réajouter directement à la queue sans tenter de remplacement
          tx.retryCount++;
          if (tx.retryCount < this.MAX_RETRIES) {
            this.addToQueue({
              burnTxHash: tx.burnTxHash,
              to: tx.to,
              amount: tx.amount,
              priority: tx.retryCount,
              timestamp: Date.now(),
              retryCount: tx.retryCount,
              lastError: "Transaction en attente depuis trop longtemps"
            });
          } else {
            // Si on a atteint le nombre maximum de tentatives, marquer comme échouée
            tx.status = 'failed';
            console.log(`Transaction ${tx.burnTxHash} a atteint le nombre maximum de tentatives (${this.MAX_RETRIES}), marquée comme échouée`);
          }
        }
      }
    }

    this.saveMintLogs();
  }

  private startQueueProcessor(): void {
    setInterval(async () => {
      if (!this.isProcessing && this.mintQueue.length > 0) {
        await this.processQueue();
      }
    }, this.QUEUE_PROCESS_INTERVAL);
  }

  private addToQueue(queueItem: MintQueueItem): void {
    // Vérifier si l'élément est déjà dans la queue
    const existingIndex = this.mintQueue.findIndex(item => item.burnTxHash === queueItem.burnTxHash);
    
    if (existingIndex >= 0) {
      // Mettre à jour l'élément existant
      this.mintQueue[existingIndex] = queueItem;
    } else {
      // Ajouter un nouvel élément
      this.mintQueue.push(queueItem);
    }
    
    // Mettre à jour les logs de queue
    this.updateQueueLogs();
    
    console.log(`Transaction ${queueItem.burnTxHash} ajoutée à la queue (tentative ${queueItem.retryCount + 1}/${this.MAX_RETRIES})`);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      // Trier la queue par priorité (retryCount)
      this.mintQueue.sort((a, b) => a.priority - b.priority);
      
      for (const item of this.mintQueue) {
        // Vérifier si la transaction est déjà en cours de traitement
        const existingLog = this.mintLogs.find(log => log.burnTxHash === item.burnTxHash);
        
        if (existingLog && existingLog.status === 'processing') {
          // Vérifier le statut de la transaction
          const status = await this.checkTransactionStatus(existingLog.mintTxHash);
          
          if (status === 'completed') {
            // Transaction réussie
            existingLog.status = 'completed';
            this.activeNonces.delete(existingLog.nonce!);
            this.saveMintLogs();
            
            // Supprimer de la queue
            this.mintQueue = this.mintQueue.filter(queueItem => queueItem.burnTxHash !== item.burnTxHash);
            this.updateQueueLogs(); // Mettre à jour les logs de queue
          } else if (status === 'failed') {
            // Transaction échouée, réessayer
            existingLog.status = 'failed';
            existingLog.retryCount++;
            this.activeNonces.delete(existingLog.nonce!);
            this.saveMintLogs();
            
            // Supprimer de la queue
            this.mintQueue = this.mintQueue.filter(queueItem => queueItem.burnTxHash !== item.burnTxHash);
            this.updateQueueLogs(); // Mettre à jour les logs de queue
            
            // Ajouter à la queue pour réessayer
            if (existingLog.retryCount < this.MAX_RETRIES) {
              this.addToQueue({
                burnTxHash: item.burnTxHash,
                to: item.to,
                amount: item.amount,
                priority: existingLog.retryCount,
                timestamp: Date.now(),
                retryCount: existingLog.retryCount
              });
            }
          }
          // Si status est 'pending', on continue à attendre
        } else {
          // Nouvelle transaction à traiter
          const success = await this.processMintTransaction(
            item.to,
            BigInt(item.amount),
            item.burnTxHash
          );
          
          if (success) {
            // Supprimer de la queue
            this.mintQueue = this.mintQueue.filter(queueItem => queueItem.burnTxHash !== item.burnTxHash);
            this.updateQueueLogs(); // Mettre à jour les logs de queue
          } else {
            // Échec du traitement, réessayer plus tard
            console.log(`Échec du traitement de la transaction ${item.burnTxHash}, nouvelle tentative prévue`);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async getNextAvailableNonce(): Promise<number> {
    const reserveAccountKey = process.env.RESERVE_ACCOUNT_KEY;
    if (!reserveAccountKey) {
      throw new Error("Clé du compte de réserve non configurée");
    }
    
    const wallet = new ethers.Wallet(reserveAccountKey, this.provider);
    const currentNonce = await wallet.getNonce();
    
    // Find the next available nonce
    let nextNonce = currentNonce;
    while (this.activeNonces.has(nextNonce)) {
      nextNonce++;
    }
    
    return nextNonce;
  }

  private async processMintTransaction(to: string, amount: bigint, burnTxHash: string): Promise<boolean> {
    try {
      // Vérifier le solde du compte de réserve
      const reserveAccountKey = process.env.RESERVE_ACCOUNT_KEY;
      if (!reserveAccountKey) {
        throw new Error("Clé du compte de réserve non configurée");
      }
      
      const wallet = new ethers.Wallet(reserveAccountKey, this.provider);
      const balance = await this.provider.getBalance(wallet.address);
      
      if (balance < amount) {
        throw new Error(`Solde insuffisant dans le compte de réserve. Requis: ${amount}, Disponible: ${balance}`);
      }

      // Récupérer le prix du gas actuel
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice;
      
      if (!gasPrice) {
        throw new Error("Impossible de récupérer le prix du gas");
      }

      // Obtenir le prochain nonce disponible
      const nonce = await this.getNextAvailableNonce();

      // Créer la transaction
      const tx = await wallet.sendTransaction({
        to,
        value: amount,
        nonce,
        gasPrice
      });

      // Créer ou mettre à jour le log de mint
      const existingLog = this.mintLogs.find(log => log.burnTxHash === burnTxHash);
      if (existingLog) {
        // Mettre à jour le log existant
        existingLog.mintTxHash = tx.hash;
        existingLog.status = 'pending';
        existingLog.nonce = nonce;
        existingLog.gasPrice = gasPrice.toString();
      } else {
        // Créer un nouveau log
        const mintLog: MintLog = {
          burnTxHash,
          mintTxHash: tx.hash,
          to,
          amount: amount.toString(),
          timestamp: Date.now(),
          status: 'pending',
          retryCount: 0,
          nonce,
          gasPrice: gasPrice.toString()
        };
        this.mintLogs.push(mintLog);
      }

      // Ajouter le nonce actif et sauvegarder
      this.activeNonces.set(nonce, existingLog || this.mintLogs[this.mintLogs.length - 1]);
      this.saveMintLogs();

      return true;
    } catch (error) {
      console.error(`Erreur lors du traitement de la transaction de mint pour ${burnTxHash}:`, error);
      return false;
    }
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

      // Ajouter à la queue
      this.addToQueue({
        burnTxHash,
        to,
        amount: amount.toString(),
        priority: 0,
        timestamp: Date.now(),
        retryCount: 0
      });
      
      return true;
    } catch (error) {
      console.error(`Erreur lors de l'ajout à la queue pour ${to}:`, error);
      return false;
    }
  }

  // Nouveau: méthode pour initialiser les logs de queue
  private initializeQueueLogs(): void {
    try {
      if (fs.existsSync(this.QUEUE_LOGS_FILE)) {
        const data = fs.readFileSync(this.QUEUE_LOGS_FILE, 'utf8');
        this.queueLogs = JSON.parse(data);
      } else {
        // Créer le répertoire si nécessaire
        const dir = path.dirname(this.QUEUE_LOGS_FILE);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        // Créer un fichier vide
        fs.writeFileSync(this.QUEUE_LOGS_FILE, JSON.stringify([], null, 2));
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation des logs de queue:', error);
      this.queueLogs = [];
    }
  }

  // Nouveau: méthode pour sauvegarder les logs de queue
  private saveQueueLogs(): void {
    try {
      fs.writeFileSync(this.QUEUE_LOGS_FILE, JSON.stringify(this.queueLogs, null, 2));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des logs de queue:', error);
    }
  }

  // Nouveau: méthode pour mettre à jour les logs de queue
  private updateQueueLogs(): void {
    // Convertir les éléments de la queue en logs de queue
    const newQueueLogs: QueueLog[] = this.mintQueue.map(item => ({
      burnTxHash: item.burnTxHash,
      to: item.to,
      amount: item.amount,
      timestamp: item.timestamp,
      retryCount: item.retryCount,
      priority: item.priority,
      lastError: item.lastError
    }));

    // Mettre à jour les logs de queue
    this.queueLogs = newQueueLogs;
    this.saveQueueLogs();
  }
} 